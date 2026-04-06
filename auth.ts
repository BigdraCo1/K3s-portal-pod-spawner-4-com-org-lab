import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || "kmitl.ac.th")
  .split(",")
  .map((d) => d.trim().toLowerCase());

const allowedEmails = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (allowedEmails.length > 0 && allowedEmails.includes(lower)) return true;
  const domain = lower.split("@")[1];
  return allowedDomains.includes(domain);
}

function extractStudentId(email: string): string {
  return email.split("@")[0].replace(/[^a-zA-Z0-9-_]/g, "");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      return isEmailAllowed(user.email);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.studentId = extractStudentId(user.email);
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.studentId) {
        (session as any).studentId = token.studentId as string;
      }
      return session;
    },
  },
});
