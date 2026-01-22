import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PageHeaderComponent } from './shared/ui/page-header/page-header.component';
import { TopSheetMenuComponent } from './shared/ui/top-sheet-menu/top-sheet-menu.component';
import { BottomNavComponent } from './shared/ui/bottom-nav/bottom-nav.component';

/**
 * Root application shell that hosts the router outlet and navigation.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PageHeaderComponent, TopSheetMenuComponent, BottomNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header />
    <app-top-sheet-menu [isOpenExternal]="menuOpen()" (closed)="closeMenu()" />
    <main>
      <router-outlet></router-outlet>
    </main>
    <app-bottom-nav (menuRequested)="openMenu()" />
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      min-height: 100dvh;
      font-family: var(--font-family, 'Inter', system-ui, -apple-system, sans-serif);
    }

    main {
      flex: 1;
      padding: var(--container-padding, var(--space-3, 0.75rem));
      padding-bottom: calc(var(--container-padding, var(--space-3, 0.75rem)) + var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px));
    }

    @media (min-width: 768px) {
      main {
        padding: var(--container-padding, var(--space-5, 1.5rem));
        padding-bottom: calc(var(--container-padding, var(--space-5, 1.5rem)) + var(--bottom-nav-height, 56px));
      }
    }
  `]
})
export class AppComponent {
  readonly menuOpen = signal(false);

  openMenu() {
    this.menuOpen.set(true);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }
}
