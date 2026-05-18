// components/Nav.tsx
import Link from "next/link";

export default function Nav() {
  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        ⬡ Prowider
      </Link>
      <Link href="/request-service" className="nav-link">
        Request Service
      </Link>
      <Link href="/dashboard" className="nav-link">
        Dashboard
      </Link>
      <Link href="/test-tools" className="nav-link">
        Test Tools
      </Link>
    </nav>
  );
}
