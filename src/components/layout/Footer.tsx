import { TreePine } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-stone-900 text-stone-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center">
                <TreePine className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white text-sm">UoM GeoLens</span>
            </div>
            <p className="text-xs leading-relaxed">
              An enterprise tree monitoring and geo-visualization platform for the University of Moratuwa campus.
            </p>
          </div>
          <div>
            <h4 className="text-white font-medium text-sm mb-3">Department</h4>
            <p className="text-xs leading-relaxed">
              Department of Town and Country Planning<br />
              Faculty of Architecture<br />
              University of Moratuwa, Sri Lanka
            </p>
          </div>
          <div>
            <h4 className="text-white font-medium text-sm mb-3">Quick Links</h4>
            <ul className="space-y-1 text-xs">
              <li><a href="/dashboard" className="hover:text-white transition-colors">Dashboard</a></li>
              <li><a href="/map" className="hover:text-white transition-colors">Tree Map</a></li>
              <li><a href="/report" className="hover:text-white transition-colors">Submit Report</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-stone-800 mt-8 pt-6 text-xs text-center">
          © {new Date().getFullYear()} University of Moratuwa — Department of Town and Country Planning. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
