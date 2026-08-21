import type { Component } from 'solid-js';
import { KaitoWordmark } from '@/verify/ui/icons';

export const PoweredBy: Component = () => (
  <footer class="pv-powered">
    <span>Powered by</span>
    <KaitoWordmark height={13} />
  </footer>
);
