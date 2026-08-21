import { render } from 'solid-js/web';
import { App } from './App';

try {
  const mount = document.getElementById('app');
  if (!mount) throw new Error('options: #app mount node not found');
  render(() => <App />, mount);
} catch (error) {
  throw error;
}
