import Link from "next/link";
import { Plane } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Plane className="h-5 w-5 text-blue-700" />
            <span className="font-medium">China Southern Virtual Group</span>
          </div>
          <div className="flex space-x-6">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-blue-700"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="text-sm text-gray-600 hover:text-blue-700"
            >
              About
            </Link>
            <Link
              href="/operations"
              className="text-sm text-gray-600 hover:text-blue-700"
            >
              Operations
            </Link>
            <Link
              href="/join-us"
              className="text-sm text-gray-600 hover:text-blue-700"
            >
              Join Us
            </Link>
          </div>
        </div>
        <div className="mt-6 text-center text-xs text-gray-500">
          China Southern Virtual Group is a virtual airline exclusively for the
          Infinite Flight platform. We have no connection or affiliation with
          China Southern Group or any other real-world airlines/organizations
          and subsidiaries. All logos and trademarks remain the property of
          China Southern Group.
        </div>
      </div>
    </footer>
  );
}
