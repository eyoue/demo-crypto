import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA} from "@angular/material/dialog";

export interface DialogData {
  title: string;
  listItems: {view: string, data: any}[];
  actionButton: {
    label: string;
    disabled: boolean;
    selectionAction: (value: any) => {};
    clickAction: () => {};
  };
  cancelButton: {
    label: string;
  };
}

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.scss']
})
export class DialogComponent implements OnInit {

  constructor(@Inject(MAT_DIALOG_DATA) public data: DialogData) { }

  ngOnInit(): void {
  }

  get actionDisabled() {
    return this.data?.actionButton?.disabled;
  }

  clickAction() {
    return this.data?.actionButton?.clickAction() || undefined;
  }

  selectAction(data: any) {
    this.data.actionButton.disabled = false;
    return this.data?.actionButton?.selectionAction(data);
  }

}
