import { ENV } from '@/lib/env';
import { isAllowedOrigin } from '@/shared/allowed-origin';

const to = new URLSearchParams(location.search).get('to');
const status = document.getElementById('status');

if (to && isAllowedOrigin(to, ENV.connectAllowedOrigins)) {
  location.replace(to);
} else if (status) {
  status.textContent = 'Unable to open sign-in.';
}
