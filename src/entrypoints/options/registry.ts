import type { Component } from 'solid-js';
import { DisplaySection } from './sections/display';
import { DebugSection } from './sections/debug';
import { BehaviorDebugSection } from './sections/behavior-debug';
import { MockSection } from './sections/mock';

export interface SettingsSection {

  id: string;

  label: string;

  Component: Component;

  devOnly?: boolean;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'display', label: 'Display', Component: DisplaySection },
  { id: 'debug', label: 'Debug', Component: DebugSection, devOnly: true },
  { id: 'behavior-debug', label: 'Behavior events', Component: BehaviorDebugSection, devOnly: true },

  { id: 'mock', label: 'Mock data', Component: MockSection, devOnly: true },
];
