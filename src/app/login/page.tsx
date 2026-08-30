import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl items-center justify-center px-4 py-12">
      <AuthForm mode="login" />
    </div>
  );
}
