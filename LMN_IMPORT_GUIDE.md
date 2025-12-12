# LMN Leads Import Guide

## 🎯 Overview

The LMN Leads Import feature allows you to upload CSV files exported from golmn.com and automatically import them as accounts and contacts in LECRM.

## 📍 How to Access

Navigate to: **Import Leads** in the main navigation menu (Upload icon)

Or go directly to: `http://localhost:5173/import-leads`

## 📊 How It Works

### Data Mapping

The system intelligently maps LMN CSV columns to LECRM data:

**Lead Name → Account**
- Each unique "Lead Name" becomes an Account in LECRM
- If multiple contacts have the same Lead Name, they're all linked to that account

**Contact Information:**
- First Name → Contact first name
- Last Name → Contact last name  
- Email → Contact email
- Phone → Contact phone
- Title/Job Title → Contact title & role

**Additional Fields:**
- Address fields are combined into full address
- Website, Industry, Revenue are captured
- All data is timestamped with import date

### Smart Features

✅ **Automatic Deduplication**: Multiple contacts with same Lead Name are grouped under one account

✅ **Flexible Column Names**: Handles variations like:
- "Lead Name" / "Company" / "Account Name"
- "First Name" / "firstname" / "First"
- "Phone" / "Phone Number" / "Phone 1"
- "Email" / "Email Address" / "E-mail"

✅ **Contact Role Detection**: Automatically assigns roles based on title:
- Owner, CEO, President → Decision Maker
- Manager, Director, VP → Influencer  
- Others → User

✅ **Address Building**: Combines Address, City, State, Zip into formatted address

✅ **Validation**: Checks for:
- Missing required fields
- Invalid email formats
- Duplicate warnings

## 📝 Full LMN CSV Format

```csv
Lead Name,First Name,Last Name,Position,Billing Contact,Email 1,Email 2,Phone 1,Phone 2,Do Not Email,Do Not Mail,Do Not Call,Send SMS,Notes
Acme Landscaping,John,Smith,Owner,Yes,john@acme.com,j.smith@gmail.com,403-555-1234,403-555-5678,No,No,No,Phone 1,Primary contact
Acme Landscaping,Jane,Doe,Office Manager,No,jane@acme.com,,403-555-1234,,No,No,No,Phone 1,Handles scheduling
Green Gardens Inc,Bob,Johnson,President,Yes,bob@green.com,,403-555-9012,,No,No,No,Phone 2,Decision maker
```

**Result:**
- **2 Accounts**: "Acme Landscaping", "Green Gardens Inc"  
- **3 Contacts**: 
  - John Smith (Acme) - Billing Contact, SMS to Phone 1
  - Jane Doe (Acme) - SMS to Phone 1
  - Bob Johnson (Green Gardens) - Billing Contact, SMS to Phone 2

**Sample CSV File**: See `sample-lmn-leads.csv` in project root for a complete example with 10 contacts across 5 accounts.

## 🚀 Import Process

### Step 1: Upload CSV
1. Click "Choose CSV File"
2. Select your LMN export (.csv file)
3. System automatically parses the file

### Step 2: Preview & Validate
- View first 5 rows of data
- See statistics:
  - Total rows
  - Accounts to be created
  - Contacts to be created
  - Average contacts per account
- Review validation results:
  - Errors (must be fixed)
  - Warnings (optional)

### Step 3: Import
1. Click "Import X Accounts & Y Contacts"
2. System creates all accounts first
3. Then creates all contacts
4. Shows success summary

### Step 4: View Results
- See counts of successful imports
- Any failures are listed
- Navigate to Accounts or Contacts to view imported data

## 📋 Required vs Optional Fields

### Required
- **Lead Name** - Must be present to create account

### Optional but Recommended
- First Name
- Last Name
- Email
- Phone
- Address
- Title

**Note**: Contacts without names will show a warning but can still be imported if they have email/phone.

## ⚠️ Common Issues & Solutions

### "Missing Lead Name column"
- Make sure your CSV has a column named "Lead Name", "Company", or "Account Name"
- Check that the header row is the first row

### "No contacts created"
- Ensure you have "First Name" or "Last Name" columns
- Or at least Email/Phone for each contact

### "Duplicate account warnings"
- This is normal! Multiple contacts with same Lead Name = 1 account with multiple contacts
- The system groups them automatically

### Invalid email warnings
- Check email format (must be: name@domain.com)
- Contacts with invalid emails can still import if they have phone numbers

## 💡 Best Practices

1. **Clean Your Data First**
   - Remove test/demo rows before export
   - Ensure Lead Names are consistent
   - Verify email formats

2. **Test with Small File**
   - Try importing 5-10 leads first
   - Verify the results look correct
   - Then import full file

3. **Check Duplicates**
   - LECRM will create new accounts/contacts
   - If you re-import the same file, you'll get duplicates
   - Review existing accounts first

4. **Use Validation**
   - Fix all errors before importing
   - Review warnings to ensure data quality

## 📊 What Gets Imported

### Account Fields
- Name (from Lead Name)
- Account Type: Prospect (default)
- Status: Active
- Revenue Segment: SMB (default)
- Source: "lmn_import"
- Phone, Website, Address, Industry, Revenue
- Notes: "Imported from LMN on [date]"

### Contact Fields
- **Basic Info**: First Name, Last Name, Position
- **Billing**: Billing Contact (Yes/No)
- **Emails**: Email 1 (primary), Email 2 (secondary)
- **Phones**: Phone 1 (primary), Phone 2 (secondary)
- **Communication Preferences**: 
  - Do Not Email (checkbox)
  - Do Not Mail (checkbox)
  - Do Not Call (checkbox)
  - Send SMS (Phone 1 / Phone 2 / Do not SMS)
- **Notes**: Custom notes field
- **System Fields**: Role (auto-assigned), Source ("lmn_import"), Created Date

## 🔄 After Import

Your imported data appears immediately in:
- **Accounts page** - View all imported companies
- **Contacts page** - View all imported contacts
- **Account Detail** - See contacts linked to each account

You can then:
- Add tasks to follow up
- Enroll in sequences
- Take scorecards
- Add interactions

## 🎓 Tips for LMN Users

1. **Export from LMN:**
   - Go to your Leads section
   - Select leads to export
   - Choose CSV format
   - Download file

2. **Column Mapping:**
   - LMN's "Lead Name" = Your account name
   - Contact fields map directly

3. **Multiple Contacts:**
   - Export all contacts for each lead
   - System automatically groups them

4. **Tags/Categories:**
   - Consider adding "Industry" field in LMN
   - This helps with segmentation in LECRM

## 📞 Need Help?

If you encounter issues:
1. Check the validation messages
2. Review this guide
3. Try with a smaller test file
4. Check your CSV file opens correctly in Excel/Sheets

## 🚀 Future Enhancements

Potential additions:
- Schedule automatic imports
- Map to custom fields
- Merge with existing accounts
- Import history tracking
- Rollback feature












