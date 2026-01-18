// Email Service using EmailJS (Updated for v3)
class EmailService {
    constructor() {
        // EmailJS Configuration - UPDATED WITH CORRECT KEY
        this.emailjsConfig = {
            serviceId: 'service_gmhtqq6',      // Your Service ID
            templateId: 'template_cr7qlwe',    // Your template ID
            publicKey: '8Mkd4ns57jUU3KZJ7'     // Your Public Key (Updated)
        };
        
        this.notificationPreferences = {};
        this.loadPreferences();
        
        // Initialize EmailJS
        this.initEmailJS();
    }

    // Initialize EmailJS
    initEmailJS() {
        console.log('Initializing EmailJS...');
        
        if (typeof emailjs === 'undefined') {
            console.error('EmailJS SDK not loaded!');
            console.error('Make sure to include: <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>');
            return false;
        }
        
        try {
            // Initialize with the public key
            emailjs.init(this.emailjsConfig.publicKey);
            console.log('✅ EmailJS initialized successfully');
            console.log('Public Key:', this.emailjsConfig.publicKey);
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize EmailJS:', error);
            return false;
        }
    }

    // Load notification preferences from localStorage
    loadPreferences() {
        try {
            const saved = localStorage.getItem('ventiguard_email_preferences');
            if (saved) {
                this.notificationPreferences = JSON.parse(saved);
                console.log('Loaded email preferences:', this.notificationPreferences);
            }
        } catch (error) {
            console.error('Error loading email preferences:', error);
            this.notificationPreferences = {};
        }
    }

    // Save notification preferences to localStorage
    savePreferences() {
        try {
            localStorage.setItem('ventiguard_email_preferences', 
                JSON.stringify(this.notificationPreferences));
        } catch (error) {
            console.error('Error saving email preferences:', error);
        }
    }

    // Set notification preference for a node
    setNotificationPreference(nodePath, email, enabled, userName = null) {
        if (!this.notificationPreferences[nodePath]) {
            this.notificationPreferences[nodePath] = {};
        }
        this.notificationPreferences[nodePath] = {
            email: email,
            userName: userName || email.split('@')[0],
            enabled: enabled,
            lastSent: null,
            alertCount: 0
        };
        this.savePreferences();
        console.log(`Email preference set for ${nodePath}:`, this.notificationPreferences[nodePath]);
    }

    // Get notification preference for a node
    getNotificationPreference(nodePath) {
        return this.notificationPreferences[nodePath] || {
            email: null,
            userName: null,
            enabled: false,
            lastSent: null,
            alertCount: 0
        };
    }

    // Check if notifications are enabled for a node
    isNotificationEnabled(nodePath) {
        const pref = this.getNotificationPreference(nodePath);
        return pref.enabled && pref.email;
    }

    // Send email notification using EmailJS
    async sendEmail(toEmail, templateParams) {
        console.log('=== EmailJS Debug ===');
        console.log('Service ID:', this.emailjsConfig.serviceId);
        console.log('Template ID:', this.emailjsConfig.templateId);
        console.log('Public Key:', this.emailjsConfig.publicKey);
        console.log('To Email:', toEmail);
        console.log('Template Params:', templateParams);

        // Check if EmailJS is available
        if (typeof emailjs === 'undefined') {
            console.error('❌ EmailJS SDK not loaded!');
            return false;
        }

        // Check if initialized
        if (!emailjs._publicKey) {
            console.warn('EmailJS not initialized. Initializing now...');
            this.initEmailJS();
        }

        try {
            // CRITICAL: Add to_email to template params for EmailJS v3
            // This must match the variable in your EmailJS template
            const params = {
                ...templateParams,
                to_email: toEmail,      // REQUIRED for EmailJS v3
                reply_to: toEmail       // Optional but recommended
            };

            console.log('Sending email with params:', params);

            // Send email via EmailJS v3
            const response = await emailjs.send(
                this.emailjsConfig.serviceId,
                this.emailjsConfig.templateId,
                params
            );

            console.log('✅ Email sent successfully! Status:', response.status);
            console.log('Response:', response);
            return response.status === 200;
            
        } catch (error) {
            console.error('=== EmailJS Error ===');
            console.error('Error object:', error);
            
            if (error.text) {
                console.error('Error details:', error.text);
            }
            if (error.status) {
                console.error('Error status:', error.status);
            }
            
            // Common error checks
            if (error.status === 400) {
                console.error('Bad Request: Check template parameters or template syntax');
            } else if (error.status === 401) {
                console.error('Unauthorized: Check Public Key - it might be incorrect');
            } else if (error.status === 404) {
                console.error('Not Found: Check Service ID or Template ID');
            } else if (error.status === 422) {
                console.error('Validation Error: Missing required parameters');
                console.error('Make sure your template has "to_email" field and all required parameters');
                console.error('Check EmailJS template variables match your parameters');
            } else if (error.status === 429) {
                console.error('Rate Limited: Too many requests, wait and try again');
            } else if (error.status === 418) {
                console.error('SDK Version Error: Using outdated EmailJS SDK');
                console.error('Make sure you are using: https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js');
            }
            
            return false;
        }
    }

    // Check if we should send alert (cooldown logic)
    shouldSendAlert(nodePath, alertType) {
        const pref = this.getNotificationPreference(nodePath);
        
        if (!pref.enabled || !pref.email) {
            console.log(`Email disabled or no email for ${nodePath}`);
            return false;
        }

        // Check cooldown periods
        if (pref.lastSent) {
            const lastSentTime = new Date(pref.lastSent).getTime();
            const currentTime = new Date().getTime();
            
            let cooldownPeriod;
            if (alertType === 'DANGER') {
                cooldownPeriod = 5 * 60 * 1000; // 5 minutes for DANGER
            } else {
                cooldownPeriod = 10 * 60 * 1000; // 10 minutes for WARN
            }
            
            if (currentTime - lastSentTime < cooldownPeriod) {
                console.log(`Email notification on cooldown for ${nodePath}. Last sent: ${pref.lastSent}`);
                return false;
            }
        }

        return true;
    }

    // Prepare template parameters for alert
    prepareAlertParams(alertType, nodeName, locationName, sensorData) {
        const isDanger = alertType === 'DANGER';
        
        // Get the user's name from preferences
        const nodePath = `${locationName}/${nodeName}`;
        const pref = this.getNotificationPreference(nodePath);
        
        return {
            name: pref.userName || 'User',
            alert_type: alertType,
            alert_color: isDanger ? '#e74c3c' : '#f39c12',
            alert_icon: isDanger ? '🚨' : '⚠️',
            node_name: nodeName,
            location_name: locationName,
            risk_level: sensorData.risk_level || alertType,
            risk_score: sensorData.risk_score?.toFixed(0) || (isDanger ? '85' : '65'),
            temperature: sensorData.temperature?.toFixed(1) || '--',
            humidity: sensorData.humidity?.toFixed(0) || '--',
            air_quality: sensorData.air_quality || '--',
            occupancy: sensorData.ir_count || '0',
            node_status: sensorData.risk_level || alertType,
            action_message: sensorData.action || this.getDefaultAction(alertType),
            timestamp: new Date().toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            dashboard_url: window.location.origin || 'https://ventiguard.com',
            year: new Date().getFullYear().toString()
        };
    }

    // Get default action message based on alert type
    getDefaultAction(alertType) {
        if (alertType === 'DANGER') {
            return 'Immediate action required! Check ventilation, consider evacuation if necessary, and contact maintenance team immediately.';
        } else {
            return 'Warning conditions detected. Please monitor the situation, check ventilation systems, and prepare for possible escalation.';
        }
    }

    // Send danger alert email
    async sendDangerAlert(nodePath, nodeName, locationName, sensorData) {
        if (!this.shouldSendAlert(nodePath, 'DANGER')) {
            console.log(`Skipping danger alert for ${nodePath} - cooldown or disabled`);
            return false;
        }

        const pref = this.getNotificationPreference(nodePath);
        if (!pref.email) {
            console.error(`No email configured for ${nodePath}`);
            return false;
        }

        const templateParams = this.prepareAlertParams('DANGER', nodeName, locationName, sensorData);

        try {
            const success = await this.sendEmail(pref.email, templateParams);
            
            if (success) {
                // Update last sent time and increment count
                pref.lastSent = new Date().toISOString();
                pref.alertCount = (pref.alertCount || 0) + 1;
                this.notificationPreferences[nodePath] = pref;
                this.savePreferences();
                
                console.log(`✅ Danger alert email sent to ${pref.email} for ${nodePath}`);
                return true;
            } else {
                console.log(`❌ Failed to send danger alert to ${pref.email} for ${nodePath}`);
                return false;
            }
        } catch (error) {
            console.error('Failed to send danger alert email:', error);
            return false;
        }
    }

    // Send warning alert email
    async sendWarningAlert(nodePath, nodeName, locationName, sensorData) {
        if (!this.shouldSendAlert(nodePath, 'WARN')) {
            console.log(`Skipping warning alert for ${nodePath} - cooldown or disabled`);
            return false;
        }

        const pref = this.getNotificationPreference(nodePath);
        if (!pref.email) {
            console.error(`No email configured for ${nodePath}`);
            return false;
        }

        const templateParams = this.prepareAlertParams('WARN', nodeName, locationName, sensorData);

        try {
            const success = await this.sendEmail(pref.email, templateParams);
            
            if (success) {
                // Update last sent time and increment count
                pref.lastSent = new Date().toISOString();
                pref.alertCount = (pref.alertCount || 0) + 1;
                this.notificationPreferences[nodePath] = pref;
                this.savePreferences();
                
                console.log(`✅ Warning alert email sent to ${pref.email} for ${nodePath}`);
                return true;
            } else {
                console.log(`❌ Failed to send warning alert to ${pref.email} for ${nodePath}`);
                return false;
            }
        } catch (error) {
            console.error('Failed to send warning alert email:', error);
            return false;
        }
    }

    // Test email functionality
    async testEmail(userEmail, userName = null) {
        console.log('=== Starting Email Test ===');
        console.log('Testing email to:', userEmail);
        
        // Verify EmailJS is loaded
        if (typeof emailjs === 'undefined') {
            console.error('❌ EmailJS SDK not loaded!');
            return { success: false, message: '❌ EmailJS SDK not loaded. Check console for details.' };
        }
        
        // Verify initialization
        if (!emailjs._publicKey) {
            console.warn('EmailJS not initialized. Initializing now...');
            this.initEmailJS();
        }
        
        const testParams = {
            name: userName || 'Test User',
            alert_type: 'TEST',
            alert_color: '#4361ee',
            alert_icon: '📧',
            node_name: 'Test-Node-001',
            location_name: 'Test Laboratory',
            risk_level: 'TEST',
            risk_score: '50',
            temperature: '25.5',
            humidity: '55',
            air_quality: '800',
            occupancy: '3',
            node_status: 'TEST MODE',
            action_message: 'This is a test email from VentiGuard system. If you receive this, email notifications are working correctly.',
            timestamp: new Date().toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            dashboard_url: window.location.origin || 'https://ventiguard.com',
            year: new Date().getFullYear().toString()
        };

        try {
            console.log('Sending test email with params:', testParams);
            const success = await this.sendEmail(userEmail, testParams);
            
            if (success) {
                console.log('✅ Test email sent successfully');
                return { success: true, message: '✅ Test email sent successfully! Check your inbox and spam folder.' };
            } else {
                console.log('❌ Failed to send test email');
                return { success: false, message: '❌ Failed to send test email. Check console for error details.' };
            }
        } catch (error) {
            console.error('Test email failed:', error);
            return { success: false, message: '❌ Test email failed: ' + error.message };
        }
    }

    // Get all nodes with email notifications enabled
    getEnabledNodes() {
        return Object.keys(this.notificationPreferences)
            .filter(nodePath => this.isNotificationEnabled(nodePath))
            .map(nodePath => ({
                nodePath,
                ...this.notificationPreferences[nodePath]
            }));
    }

    // Clear all email preferences
    clearAllPreferences() {
        this.notificationPreferences = {};
        this.savePreferences();
        console.log('All email preferences cleared');
    }

    // Debug function to check EmailJS status
    debugEmailJS() {
        console.log('=== EmailJS Debug Info ===');
        console.log('EmailJS loaded:', typeof emailjs !== 'undefined');
        console.log('EmailJS initialized:', emailjs ? !!emailjs._publicKey : false);
        console.log('Public key:', emailjs ? emailjs._publicKey : 'Not loaded');
        console.log('Config:', this.emailjsConfig);
        console.log('Enabled nodes:', this.getEnabledNodes());
    }
}

// Create global instance
const emailService = new EmailService();

// Add debug function to window for easy testing
window.debugEmailService = () => emailService.debugEmailJS();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EmailService, emailService };
}