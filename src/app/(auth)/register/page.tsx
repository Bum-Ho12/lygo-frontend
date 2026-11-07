"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RegisterForm } from "@/features/auth/register-form";

function Register() {
  return <RegisterForm next={useSearchParams().get("next")} />;
}

export default function RegisterPage() {
  return (
    <Suspense>
      <Register />
    </Suspense>
  );
}
