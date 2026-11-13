import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

// Retain bookmarks from AngularJS's hashbang router.
if (location.hash.startsWith('#!')) location.replace(location.href.replace('#!', '#'));
bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(), provideRouter(routes, withHashLocation())],
}).catch((error) => console.error(error));
