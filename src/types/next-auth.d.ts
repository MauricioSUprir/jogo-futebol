import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      papel: "admin" | "editor";
    } & DefaultSession["user"];
  }
  interface User {
    papel: "admin" | "editor";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    papel?: "admin" | "editor";
  }
}
