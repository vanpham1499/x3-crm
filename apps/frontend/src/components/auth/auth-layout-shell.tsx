'use client';

import Image from 'next/image';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { Box, IconButton, Link, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { siteConfig } from '@/config/site';
import backgroundBlur from '@assets/images/background-3-blur.webp';
import dashboardIllustration from '@assets/images/illustration-dashboard.webp';
import amplifyIcon from '@assets/icons/ic-amplify.svg';
import auth0Icon from '@assets/icons/ic-auth0.svg';
import firebaseIcon from '@assets/icons/ic-firebase.svg';
import jwtIcon from '@assets/icons/ic-jwt.svg';
import supabaseIcon from '@assets/icons/ic-supabase.svg';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';

const platformIcons = [
  { src: jwtIcon, alt: 'JWT' },
  { src: firebaseIcon, alt: 'Firebase' },
  { src: amplifyIcon, alt: 'Amplify' },
  { src: auth0Icon, alt: 'Auth0' },
  { src: supabaseIcon, alt: 'Supabase' },
];

export function AuthLayoutShell({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.paper', color: 'text.primary' }}>
      <Box
        component="header"
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          zIndex: 10,
          height: 72,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Image
          src={x3salesLogo}
          alt={`${siteConfig.companyName} logo`}
          width={128}
          height={46}
          priority
          style={{ width: 112, height: 'auto' }}
        />

        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Link
            component="button"
            underline="none"
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              fontWeight: 700,
              color: 'text.primary',
            }}
          >
            Cần hỗ trợ?
          </Link>
          <IconButton size="small" sx={{ color: 'text.disabled' }}>
            <SettingsRoundedIcon />
          </IconButton>
        </Stack>
      </Box>

      <Box
        component="main"
        sx={{
          minHeight: '100vh',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '480px minmax(0, 1fr)' },
        }}
      >
        <Stack
          component="section"
          sx={{
            display: { xs: 'none', lg: 'flex' },
            alignItems: 'center',
            px: 0,
            pt: 0,
            borderRight: 1,
            borderColor: 'divider',
            backgroundImage: `linear-gradient(0deg, rgba(255,255,255,.92), rgba(255,255,255,.92)), url(${backgroundBlur.src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}

          className="flex items-center justify-center flex-col"
        >
          <Box sx={{ width: 316, textAlign: 'center' }}>
            <Typography variant="h3">Chào mừng trở lại</Typography>
            <Typography sx={{ mt: 1.5, color: 'text.secondary' }}>
              Quản lý khách hàng và đội ngũ hiệu quả hơn trong một nền tảng.
            </Typography>
          </Box>

          <Box sx={{ mt: 8, display: 'flex', justifyContent: 'center' }}>
            <Image
              src={dashboardIllustration}
              alt="Minh họa dashboard"
              width={432}
              height={324}
              priority
              style={{ width: 432, maxWidth: '100%', height: 'auto' }}
            />
          </Box>

          <Stack direction="row" spacing={2} sx={{ mt: 8, justifyContent: 'center' }}>
            {platformIcons.map((icon) => (
              <Box
                key={icon.alt}
                sx={{
                  width: 32,
                  height: 32,
                }}
              >
                <Image src={icon.src} alt={icon.alt} width={32} height={32} />
              </Box>
            ))}
          </Stack>
        </Stack>

        <Stack
          component="section"
          sx={{ px: 3, py: 12, alignItems: 'center', justifyContent: 'center' }}
        >
          <Box sx={{ width: 1, maxWidth: 420 }}>
            <Box sx={{ display: { lg: 'none' }, mb: 5 }}>
              <Image
                src={x3salesLogo}
                alt={`${siteConfig.companyName} logo`}
                width={132}
                height={48}
                style={{ width: 132, height: 'auto', marginBottom: 32 }}
              />
              <Typography variant="h3">Chào mừng trở lại</Typography>
              <Typography sx={{ mt: 1.5, color: 'text.secondary' }}>
                Quản lý khách hàng và đội ngũ hiệu quả hơn trong một nền tảng.
              </Typography>
            </Box>

            {children}
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
