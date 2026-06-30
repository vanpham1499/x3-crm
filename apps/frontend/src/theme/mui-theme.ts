'use client';

import { createTheme } from '@mui/material/styles';
import { siteConfig } from '@/config/site';

export const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: siteConfig.brand.primary,
    },
    secondary: {
      main: siteConfig.brand.secondary,
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: '#111827',
      secondary: '#637381',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      '"Public Sans Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    h3: {
      fontSize: 32,
      fontWeight: 700,
      lineHeight: 1.5,
    },
    h5: {
      fontSize: 20,
      fontWeight: 700,
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#637381',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#111827',
            borderWidth: 2,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          '&.Mui-focused': {
            color: '#111827',
          },
        },
      },
    },
  },
});
