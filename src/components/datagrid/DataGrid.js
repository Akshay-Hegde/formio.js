import _ from 'lodash';
import NestedComponent from '../nested/NestedComponent';

export default class DataGridComponent extends NestedComponent {
  static schema(...extend) {
    return NestedComponent.schema({
      label: 'Data Grid',
      key: 'dataGrid',
      type: 'datagrid',
      clearOnHide: true,
      input: true,
      tree: true,
      components: []
    }, ...extend);
  }

  static get builderInfo() {
    return {
      title: 'Data Grid',
      icon: 'fa fa-th',
      group: 'data',
      documentation: 'http://help.form.io/userguide/#datagrid',
      weight: 20,
      schema: DataGridComponent.schema()
    };
  }

  constructor(component, options, data) {
    super(component, options, data);
    this.type = 'datagrid';
    this.numRows = 0;
    this.numColumns = 0;
    this.rows = [];
  }

  get defaultSchema() {
    return DataGridComponent.schema();
  }

  get emptyValue() {
    return [{}];
  }

  get addAnotherPosition() {
    return _.get(this.component, 'addAnotherPosition', 'bottom');
  }

  hasAddButton() {
    const maxLength = _.get(this.component, 'validate.maxLength');
    return !this.component.disableAddingRemovingRows &&
    !this.shouldDisable &&
      !this.options.builder &&
      !this.options.preview &&
      (!maxLength || (this.dataValue.length < maxLength));
  }

  hasExtraColumn() {
    return this.hasRemoveButtons() || this.options.builder;
  }

  hasRemoveButtons() {
    return !this.component.disableAddingRemovingRows &&
      !this.shouldDisable &&
      !this.options.builder &&
      (this.dataValue.length > _.get(this.component, 'validate.minLength', 0));
  }

  hasTopSubmit() {
    return this.hasAddButton() && ['top', 'both'].includes(this.addAnotherPosition);
  }

  hasBottomSubmit() {
    return this.hasAddButton() && ['bottom', 'both'].includes(this.addAnotherPosition);
  }

  hasChanged(before, after) {
    return !_.isEqual(before, after);
  }

  build() {
    this.createElement();
    this.createLabel(this.element);
    let tableClass = 'table datagrid-table table-bordered form-group formio-data-grid ';
    _.each(['striped', 'bordered', 'hover', 'condensed'], (prop) => {
      if (this.component[prop]) {
        tableClass += `table-${prop} `;
      }
    });
    this.tableElement = this.ce('table', {
      class: tableClass
    });
    this.element.appendChild(this.tableElement);
    if (!this.dataValue.length) {
      this.addNewValue();
    }
    this.visibleColumns = true;
    this.errorContainer = this.element;
    this.restoreValue();
    this.createDescription(this.element);
  }

  setVisibleComponents() {
    // Add new values based on minLength.
    for (let dIndex = this.dataValue.length; dIndex < _.get(this.component, 'validate.minLength', 0); dIndex++) {
      this.dataValue.push({});
    }

    this.numColumns = this.hasExtraColumn() ? 1 : 0;
    this.numRows = this.dataValue.length;

    if (this.visibleColumns === true) {
      this.numColumns += this.component.components.length;
      this.visibleComponents = this.component.components;
      return this.visibleComponents;
    }

    this.visibleComponents = _.filter(this.component.components, comp => this.visibleColumns[comp.key]);
    this.numColumns += this.visibleComponents.length;
  }

  buildRows() {
    this.setVisibleComponents();
    this.destroy();
    this.empty(this.tableElement);

    // Build the rows.
    const tableRows = [];
    this.dataValue.forEach((row, rowIndex) => tableRows.push(this.buildRow(row, rowIndex)));

    // Create the header (must happen after build rows to get correct column length)
    const header = this.createHeader();
    if (header) {
      this.tableElement.appendChild(header);
    }
    this.tableElement.appendChild(this.ce('tbody', null, tableRows));

    // Create the add row button footer element.
    if (this.hasBottomSubmit()) {
      this.tableElement.appendChild(this.ce('tfoot', null,
        this.ce('tr', null,
          this.ce('td', { colspan: this.numColumns },
            this.addButton()
          )
        )
      ));
    }
  }

  // Build the header.
  createHeader() {
    const hasTopButton = this.hasTopSubmit();
    const hasEnd = this.hasExtraColumn() || hasTopButton;
    let needsHeader = false;
    const thead = this.ce('thead', null, this.ce('tr', null,
      [
        this.visibleComponents.map(comp => {
          const th = this.ce('th');
          if (comp.validate && comp.validate.required) {
            th.setAttribute('class', 'field-required');
          }
          const title = comp.label || comp.title;
          if (title && !comp.dataGridLabel) {
            needsHeader = true;
            th.appendChild(this.text(title));
            this.createTooltip(th, comp);
          }
          return th;
        }),
        hasEnd ? this.ce('th', null, (hasTopButton ? this.addButton(true) : null)) : null,
      ]
    ));
    return needsHeader ? thead : null;
  }

  get dataValue() {
    const dataValue = super.dataValue;
    if (!dataValue || !_.isArray(dataValue)) {
      return this.emptyValue;
    }
    return dataValue;
  }

  set dataValue(value) {
    super.dataValue = value;
  }

  get defaultValue() {
    const value = super.defaultValue;
    if (_.isArray(value)) {
      return value;
    }
    if (value && (typeof value === 'object')) {
      return [value];
    }
    return this.emptyValue;
  }

  buildRow(row, index) {
    this.rows[index] = {};
    let lastColumn = null;
    if (this.hasRemoveButtons()) {
      lastColumn = this.ce('td', null, this.removeButton(index));
    }
    else if (this.options.builder) {
      lastColumn = this.ce('td', {
        id: `${this.id}-drag-container`,
        class: 'drag-container'
      }, this.ce('div', {
        id: `${this.id}-placeholder`,
        class: 'alert alert-info',
        style: 'text-align:center; margin-bottom: 0px;',
        role: 'alert'
      }, this.text('Drag and Drop a form component')));
      this.root.addDragContainer(lastColumn, this);
    }
    return this.ce('tr', null,
      [
        this.component.components.map((col, colIndex) => this.buildComponent(col, colIndex, row, index)),
        lastColumn
      ]
    );
  }

  destroyRows() {
    _.each(this.rows, row => _.each(row, col => this.removeComponent(col, row)));
    this.rows = [];
  }

  destroy(all) {
    super.destroy(all);
    this.destroyRows();
  }

  buildComponent(col, colIndex, row, rowIndex) {
    var container;
    const isVisible = this.visibleColumns &&
      (!this.visibleColumns.hasOwnProperty(col.key) || this.visibleColumns[col.key]);
    if (isVisible) {
      container = this.ce('td');
      container.noDrop = true;
    }
    const column = _.clone(col);
    const options = _.clone(this.options);
    options.name += `[${rowIndex}]`;
    options.row = `${rowIndex}-${colIndex}`;
    options.inDataGrid = true;
    const comp = this.createComponent(_.assign({}, column, {
      row: options.row
    }), options, row);
    comp.rowIndex = rowIndex;
    this.hook('addComponent', container, comp, this);
    this.rows[rowIndex][column.key] = comp;
    if (isVisible) {
      container.appendChild(comp.getElement());
      return container;
    }
  }

  checkConditions(data) {
    let show = super.checkConditions(data);
    // If table isn't visible, don't bother calculating columns.
    if (!show) {
      return false;
    }
    let rebuild = false;
    if (this.visibleColumns === true) {
      this.visibleColumns = {};
    }
    _.each(this.component.components, (col) => {
      let showColumn = false;
      _.each(this.rows, (comps) => {
        if (comps && comps[col.key] && typeof comps[col.key].checkConditions === 'function') {
          showColumn |= comps[col.key].checkConditions(data);
        }
      });
      showColumn = showColumn && col.type !== 'hidden' && !col.hidden;
      if (
        (this.visibleColumns[col.key] && !showColumn) ||
        (!this.visibleColumns[col.key] && showColumn)
      ) {
        rebuild = true;
      }

      this.visibleColumns[col.key] = showColumn;
      show |= showColumn;
    });

    // If a rebuild is needed, then rebuild the table.
    if (rebuild) {
      this.restoreValue();
    }

    // Return if this table should show.
    return show;
  }

  setValue(value, flags) {
    flags = this.getFlags.apply(this, arguments);
    if (!value) {
      this.buildRows();
      return;
    }
    if (!Array.isArray(value)) {
      if (typeof value === 'object') {
        value = [value];
      }
      else {
        this.buildRows();
        return;
      }
    }

    const changed = this.hasChanged(value, this.dataValue);
    this.dataValue = value;
    this.buildRows();
    _.each(this.rows, (row, index) => {
      if (value.length <= index) {
        return;
      }
      _.each(row, (col, key) => {
        if (col.type === 'components') {
          col.setValue(value[index], flags);
        }
        else if (value[index].hasOwnProperty(key)) {
          col.setValue(value[index][key], flags);
        }
        else {
          col.data = value[index];
          col.setValue(col.defaultValue, flags);
        }
      });
    });
    return changed;
  }

  /**
   * Get the value of this component.
   *
   * @returns {*}
   */
  getValue() {
    if (this.viewOnly) {
      return this.dataValue;
    }
    const values = [];
    _.each(this.rows, (row) => {
      const value = {};
      _.each(row, (col) => {
        if (col && col.key) {
          _.set(value, col.key, col.getValue());
        }
      });
      values.push(value);
    });
    return values;
  }
}
