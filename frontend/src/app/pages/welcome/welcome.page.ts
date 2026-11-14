import { Component } from '@angular/core';
import { CustomerWelcome } from '../../components/customer-welcome/customer-welcome.component';

@Component({
  selector: 'app-welcome',
  imports: [CustomerWelcome],
  templateUrl: './welcome.page.html',
})
export class WelcomePage {}
