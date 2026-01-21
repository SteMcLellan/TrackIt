import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopSheetMenuComponent } from './shared/ui/top-sheet-menu/top-sheet-menu.component';

/**
 * Root application shell that hosts the router outlet and top-level actions.
 */
@Component({
    selector: 'app-root',
    imports: [RouterOutlet, TopSheetMenuComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent {
}
