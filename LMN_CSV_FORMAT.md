# LMN CSV Import Format

## 📋 Expected CSV Structure

Your CSV from LMN (golmn.com) should contain the following columns:

### Account Fields
- **Lead Name** (Required) - The company/account name

### Contact Fields

#### Basic Information
- **First Name** - Contact's first name
- **Last Name** - Contact's last name  
- **Position** - Job title/position

#### Billing
- **Billing Contact** - Checkbox field (Yes/No, True/False, 1/0, X/-)

#### Email Addresses
- **Email 1** - Primary email address
- **Email 2** - Secondary email address

#### Phone Numbers
- **Phone 1** - Primary phone number
- **Phone 2** - Secondary phone number

#### Communication Preferences (Checkboxes)
- **Do Not Email** - (Yes/No, True/False, 1/0, X/-)
- **Do Not Mail** - (Yes/No, True/False, 1/0, X/-)
- **Do Not Call** - (Yes/No, True/False, 1/0, X/-)

#### SMS Settings
- **Send SMS** - Dropdown value:
  - "Phone 1" - Send SMS to Phone 1
  - "Phone 2" - Send SMS to Phone 2
  - "Do not SMS" - Don't send SMS

#### Additional Information
- **Notes** - Any additional notes about the contact

## 📄 Example CSV Format

```csv
Lead Name,First Name,Last Name,Position,Billing Contact,Email 1,Email 2,Phone 1,Phone 2,Do Not Email,Do Not Mail,Do Not Call,Send SMS,Notes
Acme Landscaping,John,Smith,Owner,Yes,john@acme.com,j.smith@acme.com,555-1234,555-5678,No,No,No,Phone 1,Primary contact
Acme Landscaping,Jane,Doe,Office Manager,No,jane@acme.com,,555-1234,,No,No,No,Phone 1,Handles scheduling
Green Gardens Inc,Bob,Johnson,President,Yes,bob@greengardens.com,,555-9012,555-9013,No,No,No,Phone 2,Decision maker
Mountain View Lawn,Alice,Brown,Manager,No,alice@mvlawn.com,alice.brown@mvlawn.com,555-3456,,Yes,No,No,Do not SMS,Prefers email only
```

## 🔄 How Data is Imported

### Accounts Created
Each unique **Lead Name** becomes an Account:
- Acme Landscaping
- Green Gardens Inc
- Mountain View Lawn

### Contacts Created
All rows with contact information become Contacts, linked to their account:
- John Smith (Acme Landscaping) - Billing Contact, SMS to Phone 1
- Jane Doe (Acme Landscaping) - SMS to Phone 1
- Bob Johnson (Green Gardens Inc) - Billing Contact, SMS to Phone 2  
- Alice Brown (Mountain View Lawn) - Do Not Email, Do Not SMS

## ✅ Field Value Formats

### Boolean Fields (Checkboxes)
These fields accept multiple formats:

**TRUE values:**
- "Yes" / "yes" / "Y"
- "True" / "true" / "TRUE"
- "1"
- "Checked" / "checked"
- "X" / "x"
- "On" / "on"

**FALSE values:**
- "No" / "no" / "N"
- "False" / "false" / "FALSE"
- "0"
- "" (empty)
- "-"
- "Off" / "off"

### SMS Dropdown Values
- **"Phone 1"** - Send SMS to Phone 1
- **"Phone 2"** - Send SMS to Phone 2
- **"Do not SMS"** / **"Do Not SMS"** / **empty** - Don't send SMS

## 🎯 Required vs Optional

### Required Fields
- **Lead Name** - Must have at least one account name

### Highly Recommended
- **First Name** or **Last Name** - At least one name field for contacts
- **Email 1** or **Phone 1** - At least one contact method

### Optional (but tracked)
- Position
- Billing Contact
- Email 2
- Phone 2
- Do Not Email/Mail/Call
- Send SMS
- Notes

## 💡 Import Tips

### 1. Multiple Contacts per Account
Same Lead Name = Grouped under one account

```csv
Lead Name,First Name,Last Name,Email 1
Acme Corp,John,Smith,john@acme.com
Acme Corp,Jane,Doe,jane@acme.com
```

Result: 1 Account (Acme Corp) with 2 Contacts (John & Jane)

### 2. Billing Contacts
Mark primary billing contact for each account:

```csv
Lead Name,First Name,Last Name,Billing Contact
Acme Corp,John,Smith,Yes
Acme Corp,Jane,Doe,No
```

John Smith will be flagged as the billing contact.

### 3. Communication Preferences
Respect opt-out preferences:

```csv
First Name,Do Not Email,Do Not Mail,Do Not Call,Send SMS
John,No,No,No,Phone 1
Jane,Yes,No,No,Do not SMS
```

- John: Can contact via all methods, SMS to Phone 1
- Jane: Cannot email, cannot SMS

### 4. Phone Number Formats
Any format works - system stores as-is:
- 555-1234
- (555) 123-4567
- 555.123.4567
- +1-555-123-4567

### 5. Notes Field
Add any relevant information:
```
"Primary decision maker, prefers morning calls, interested in spring services"
```

## 🚫 Common Issues

### Missing Lead Name
❌ **Error**: "Missing Lead Name column"
✅ **Fix**: Ensure CSV has "Lead Name" column header

### No Contact Information
⚠️ **Warning**: "Contact has no email or phone"
✅ **Fix**: Add at least Email 1 or Phone 1 for each contact

### Invalid Email Format
⚠️ **Warning**: "Invalid email format"
✅ **Fix**: Ensure emails match: name@domain.com

### Checkbox Values
Some systems export checkboxes as:
- ✓ / ✗
- TRUE / FALSE
- 1 / 0
- Yes / No

All formats are supported!

## 📊 After Import

Your imported contacts will have:

✅ **Full contact information** with all fields preserved
✅ **Communication preferences** respected in future campaigns
✅ **Billing contacts** flagged for invoicing
✅ **SMS preferences** set for text messaging
✅ **Multiple phone/email** options available
✅ **Notes** attached for reference

## 🔍 Example: Complete Contact

```csv
Lead Name: Acme Landscaping
First Name: John
Last Name: Smith
Position: Owner
Billing Contact: Yes
Email 1: john@acme.com
Email 2: j.smith@personal.com
Phone 1: 555-1234
Phone 2: 555-5678
Do Not Email: No
Do Not Mail: No
Do Not Call: No
Send SMS: Phone 1
Notes: Primary contact, decision maker for all landscaping contracts
```

**Imported as:**
- Account: "Acme Landscaping"
- Contact: John Smith (Owner)
  - Billing Contact: ✓
  - Email: john@acme.com (primary), j.smith@personal.com (secondary)
  - Phone: 555-1234 (primary), 555-5678 (secondary)
  - Can Email: ✓
  - Can Mail: ✓
  - Can Call: ✓
  - SMS: Send to 555-1234
  - Notes: "Primary contact, decision maker for all landscaping contracts"

## 🎓 Next Steps

1. **Export from LMN**: Get your CSV file from golmn.com
2. **Verify Format**: Check column headers match above
3. **Import**: Use LECRM Import Leads page
4. **Review**: Check preview before finalizing
5. **Import**: Create all accounts and contacts
6. **Use**: Start managing leads in LECRM!




















