import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AppComponent } from './app.component';
import { AuthService } from './core/services/auth.service';

class MockAuthService {
  isAuthenticated = jasmine.createSpy('isAuthenticated').and.returnValue(true);
  logout = jasmine.createSpy('logout');
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let authService: MockAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useClass: MockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as unknown as MockAuthService;
    fixture.detectChanges();
  });

  it('renders brand name and logout button when authenticated', async () => {
    const harness = await RouterTestingHarness.create(TestBed);
    await harness.navigateByUrl('/');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('TrackIt');
    expect(authService.isAuthenticated).toHaveBeenCalled();
    expect(compiled.querySelector('button')?.textContent).toContain('Logout');
  });
});
