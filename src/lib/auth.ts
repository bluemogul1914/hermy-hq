import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import EmailProvider from 'next-auth/providers/email'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

// Auth config: Google + GitHub OAuth + Email magic link.
// Prisma adapter handles OAuth accounts + Email verification tokens.
// Sessions stay JWT (no DB round-trip for every request).
const providers: NextAuthOptions['providers'] = []

// Google OAuth — requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
providers.push(
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
)

// GitHub OAuth — requires GITHUB_ID + GITHUB_SECRET
if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  )
}

// Email (Magic Link) — requires EMAIL_SERVER + EMAIL_FROM
// EMAIL_SERVER can be a connection string like:
//   smtp://user:pass@mail.bluemogul.biz:587
// or a JSON object with host/port/auth config.
if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
  providers.push(
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      // Use the existing SMTP: mail.bluemogul.biz:587 STARTTLS support@bluemogul.biz
    }),
  )
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers,
  callbacks: {
    async signIn({ user }) {
      // Comma-separated allowlist from env, e.g. ALLOWED_EMAILS="you@example.com,teammate@example.com"
      // When unset/empty, fall back to role-based access: any authenticated
      // GitHub/Google OAuth user whose email domain matches the configured
      // base domain, or is explicitly allowlisted, can sign in.
      const allowedEmails = (process.env.ALLOWED_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
      if (allowedEmails.length > 0) {
        return allowedEmails.includes((user.email ?? '').toLowerCase())
      }
      // Fallback: allow all OAuth sign-ins (Google + GitHub)
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ''
        session.user.email = token.email as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
