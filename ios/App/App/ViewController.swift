import UIKit
import Capacitor
import WebKit

@objc(ViewController)
class ViewController: CAPBridgeViewController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Set view background to white immediately
        self.view.backgroundColor = UIColor.white
        
        // Keep checking and setting webview background
        self.setWebViewBackground()
        
        // Set up observer to keep background white
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleSetWebViewBackground),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }
    
    @objc private func handleSetWebViewBackground() {
        self.setWebViewBackground()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        
        // Ensure background stays white
        self.view.backgroundColor = UIColor.white
        self.setWebViewBackground()
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        
        // Final check to ensure webview background is white
        self.setWebViewBackground()
    }
    
    private func setWebViewBackground() {
        // Set main view background immediately
        self.view.backgroundColor = UIColor.white
        
        // Try to find and set webview background
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            // Set main view background again
            self.view.backgroundColor = UIColor.white
            
            // Try to access webview through subviews
            self.findAndSetWebViewBackground(in: self.view)
            
            // Keep checking periodically
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                self.findAndSetWebViewBackground(in: self.view)
            }
        }
    }
    
    private func findAndSetWebViewBackground(in view: UIView) {
        // Recursively find WKWebView and set its background
        if let webView = view as? WKWebView {
            webView.backgroundColor = UIColor.white
            webView.isOpaque = false
            webView.scrollView.backgroundColor = UIColor.white
            return
        }
        
        for subview in view.subviews {
            findAndSetWebViewBackground(in: subview)
        }
    }
}

