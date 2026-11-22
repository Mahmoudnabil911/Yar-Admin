import { createFileRoute } from '@tanstack/react-router';
import PublicSite, { publicHead } from '@/public-site/PublicSite';

export const Route = createFileRoute('/register')({
  head: () => publicHead('register'),
  component: () => <PublicSite page="register" />,
});

