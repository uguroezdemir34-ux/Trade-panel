import { SignIn } from "@clerk/nextjs";

export function generateStaticParams() {
  return [{}];
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <SignIn />
    </div>
  );
}
