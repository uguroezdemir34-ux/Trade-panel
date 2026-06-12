import { SignUp } from "@clerk/nextjs";

export function generateStaticParams() {
  return [{}];
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <SignUp />
    </div>
  );
}
