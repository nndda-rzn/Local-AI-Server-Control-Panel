import { theme as antdTheme } from 'antd';

export const BRAND = {
  primary: '#0E9F6E',
  primaryHover: '#0B8A5E',
  primaryActive: '#097852',
  primaryBg: '#E6F6F0',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
  info: '#0EA5E9',
  dark: '#0F172A',
  text: '#1F2937',
  textSecondary: '#64748B',
  border: '#E5E7EB',
  bgLayout: '#F4F6F8',
  bgCard: '#FFFFFF'
};

export const theme = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: BRAND.primary,
    colorSuccess: BRAND.success,
    colorWarning: BRAND.warning,
    colorError: BRAND.danger,
    colorInfo: BRAND.info,
    colorBgLayout: BRAND.bgLayout,
    colorBgContainer: BRAND.bgCard,
    colorText: BRAND.text,
    colorTextSecondary: BRAND.textSecondary,
    colorBorder: BRAND.border,
    fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
    fontSize: 14,
    borderRadius: 10,
    borderRadiusLG: 14,
    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
    boxShadowSecondary: '0 2px 8px rgba(15, 23, 42, 0.04)',
    wireframe: false
  },
  components: {
    Layout: {
      headerBg: '#FFFFFF',
      headerHeight: 60,
      headerPadding: '0 24px',
      siderBg: '#FFFFFF',
      bodyBg: BRAND.bgLayout
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: BRAND.primaryBg,
      itemSelectedColor: BRAND.primary,
      itemActiveBg: BRAND.primaryBg,
      itemHoverBg: '#F1F5F9',
      itemColor: BRAND.text,
      itemBorderRadius: 8
    },
    Card: {
      headerBg: 'transparent',
      headerFontSize: 15,
      paddingLG: 20
    },
    Table: {
      headerBg: '#F8FAFC',
      headerColor: BRAND.textSecondary,
      headerSplitColor: BRAND.border,
      borderColor: BRAND.border,
      rowHoverBg: '#F8FAFC'
    },
    Button: {
      controlHeight: 36,
      borderRadius: 8,
      fontWeight: 500
    },
    Input: {
      controlHeight: 36
    },
    Tag: {
      borderRadiusSM: 6
    }
  }
};
