import { Component } from '@angular/core';
import { CustomerWelcome } from '../../components/customer-welcome/customer-welcome.component';

@Component({
  selector: 'app-about',
  imports: [CustomerWelcome],
  templateUrl: './about.page.html',
})
export class AboutPage {}
