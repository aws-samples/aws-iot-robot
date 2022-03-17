import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { JoycamComponent } from './joycam.component';

describe('JoycamComponent', () => {
  let component: JoycamComponent;
  let fixture: ComponentFixture<JoycamComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ JoycamComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(JoycamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
