import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { JoymoveComponent } from './joymove.component';

describe('JoymoveComponent', () => {
  let component: JoymoveComponent;
  let fixture: ComponentFixture<JoymoveComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ JoymoveComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(JoymoveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
