'use client';

import { Box } from '@mui/material';
import { Sidebar } from '@/components/shell/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: '#f8fafc' }}>
      <Sidebar />
      <Box component="main" sx={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {children}
      </Box>
    </Box>
  );
}
