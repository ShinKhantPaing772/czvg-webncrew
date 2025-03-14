import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <img
              src="https://sea1.discourse-cdn.com/infiniteflight/user_avatar/community.infiniteflight.com/chinasouthernvg/288/886608_2.png"
              alt="China Southern Virtual Group Logo"
              className="h-6 w-6 rounded-full"
            />
            <span className="font-bold text-lg">
              China Southern Virtual Group
            </span>
          </div>
          <div className="flex flex-col justify-start">
            <span className="font-medium">Explore the community</span>
            <Link
              href="https://community.infiniteflight.com/"
              className="text-sm text-gray-600 hover:text-blue-700"
            >
              Infinite Flight Community
            </Link>
            <Link
              href="https://community.infiniteflight.com/t/china-southern-virtual-group-fly-into-your-dreams-official-thread-2021/609110?u=gds111006"
              className="text-sm text-gray-600 hover:text-blue-700"
            >
              CZVG IFC Thread
            </Link>
            <Link
              href="https://ifvarb.com/"
              className="text-sm text-gray-600 hover:text-blue-700"
            >
              IFVARB
            </Link>
          </div>
          <div className="flex flex-col justify-start">
            <span className="font-medium">Explore More</span>
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-blue-700"
            >
              Home
            </Link>
            <Link
              href="/about-us"
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
              href="/crew"
              className="text-sm text-gray-600 hover:text-blue-700"
            >
              Join Us
            </Link>
          </div>
        </div>
        <div className="mt-6 text-center text-xs text-gray-500">
          China Southern Virtual Group is a virtual airline exclusively for the
          Infinite Flight platform operating under IFVARB. We have no connection
          or affiliation with China Southern Group and its subsidaries, Infinite
          Flight or any other real-world airlines/organizations and
          subsidiaries. All logos and trademarks remain the property of China
          Southern Group and its subsidaries.
        </div>
      </div>
    </footer>
  );
}
