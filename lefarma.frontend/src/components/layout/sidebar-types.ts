import type { ElementType } from 'react';
import type { PermissionCheckOptions } from '@/utils/permissions';

export interface MenuItemBase {
  title: string;
  icon: ElementType;
  permission?: PermissionCheckOptions;
}

export interface MenuItem extends MenuItemBase {
  path: string;
}

export interface CollapsibleMenuItem extends MenuItemBase {
  isCollapsible: true;
  items: MenuItem[];
}

export type SidebarMenuItemConfig = MenuItem | CollapsibleMenuItem;
