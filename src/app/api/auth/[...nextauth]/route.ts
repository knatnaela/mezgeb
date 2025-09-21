import NextAuth from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" as const },
  allowDangerousEmailAccountLinking: process.env.NODE_ENV !== "production",
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user, account }: any) {
      if (user?.id) token.id = user.id;
      return token;
    },
    // Workaround for OAuthAccountNotLinked during development: if a user with the
    // same email already exists, link the Google account automatically.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async signIn({ user, account }: any) {
      try {
        if (process.env.NODE_ENV !== "production" && account?.provider === "google" && user?.email) {
          const existing = await prisma.user.findUnique({ where: { email: user.email } });
          if (existing) {
            const existingAccount = await prisma.account.findFirst({
              where: { provider: "google", providerAccountId: account.providerAccountId },
            });
            if (!existingAccount) {
              await prisma.account.create({
                data: {
                  userId: existing.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  refresh_token: account.refresh_token ?? null,
                  access_token: account.access_token ?? null,
                  expires_at: account.expires_at ?? null,
                  token_type: account.token_type ?? null,
                  scope: account.scope ?? null,
                  id_token: account.id_token ?? null,
                  session_state: account.session_state ?? null,
                },
              });
            }
          }
        }
      } catch (e) {
        console.error("signIn linking error", e);
      }
      return true;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      if (session.user && token?.id) {
        session.user = {
          id: token.id,
          name: session.user.name ?? null,
          email: session.user.email ?? null,
          image: session.user.image ?? null,
        };
      }
      return session;
    },
  },
};

// Cast to any to smooth over type differences across NextAuth versions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = NextAuth(authOptions as any);
export { handler as GET, handler as POST };


