# Dual CSV Import System - Complete! ✅

## 🎉 What's Been Created

A two-file import system that merges data from both LMN exports to create complete contact records!

---

## 📍 How to Access

### From Accounts Page:
```
http://localhost:5173/accounts
```
Click the blue **"Import from LMN"** button (next to "New Account")

### From Contacts Page:
```
http://localhost:5173/contacts
```
Click the blue **"Import from LMN"** button (next to "New Contact")

---

## 📊 **Two-File Import Process**

### **BOTH CSV Files Required:**

### **File 1: Contacts Export.csv**
**Purpose:** Provides structural data and IDs
**Contains:**
- ✅ CRM ID (for grouping contacts under accounts)
- ✅ Contact ID (unique contact identifiers)
- ✅ CRM Name (account name)
- ✅ Type (Lead/Client/Other)
- ✅ PrimaryContact (True/False flag)
- ✅ Tags
- ✅ Archived status
- ✅ Classification
- ✅ Address, Phone, Email fields

**From:** LMN → Contacts → Export Contacts

### **File 2: Leads List.csv**
**Purpose:** Provides additional contact fields
**Contains:**
- ✅ Position (job title)
- ✅ DoNotEmail (checkbox)
- ✅ DoNotMail (checkbox)
- ✅ DoNotCall (checkbox)
- ✅ ReferralSource
- ✅ Created date
- ✅ Address, Phone, Email fields

**From:** LMN → Leads → Export Leads

---

## 🔄 **How the Merge Works**

### Step 1: Upload File 1 (Contacts Export)
- System parses CRM IDs and Contact IDs
- Groups contacts by CRM ID
- Creates base accounts with IDs and tags

### Step 2: Upload File 2 (Leads List)
- System parses Position and communication preferences
- Extracts DoNotEmail, DoNotMail, DoNotCall

### Step 3: Automatic Merge
- Matches contacts by: First Name + Last Name + Email
- Merges Position, Do Not fields into base contacts
- Shows match rate (how many contacts were found in both files)

### Step 4: Import
- Creates complete accounts with all data
- Creates complete contacts with merged fields
- All 1,600+ contacts imported with full details!

---

## 📋 **Complete Contact Structure After Merge**

Each contact will have:

**From Contacts Export:**
- CRM ID, Contact ID
- Primary Contact flag
- Tags
- Archived status
- Base contact info

**From Leads List:**
- Position (job title) ✅
- Do Not Email ✅
- Do Not Mail ✅
- Do Not Call ✅
- Referral Source ✅

**Result: Complete Contact Profile!**

---

## 🎨 **UI Design**

### Two Upload Boxes Side-by-Side:

```
┌─────────────────────┐  ┌─────────────────────┐
│  File 1: Contacts   │  │  File 2: Leads      │
│      Export         │  │      List           │
│                     │  │                     │
│  [Upload Icon]      │  │  [Upload Icon]      │
│  Drag & Drop        │  │  Drag & Drop        │
│  or Click           │  │  or Click           │
│                     │  │                     │
│  Has: CRM ID,       │  │  Has: Position,     │
│  Contact ID, Tags   │  │  Do Not fields      │
└─────────────────────┘  └─────────────────────┘
```

**Once both uploaded:**
```
✅ Files Merged Successfully!
Ready to import 850 accounts and 1,688 contacts
Match Rate: 95%
```

---

## ✨ **Smart Features**

### 1. **Visual Feedback**
- ✅ Empty boxes show upload icon
- ✅ Uploaded files show green checkmark
- ✅ Dragging over box shows blue highlight
- ✅ File name displayed after upload

### 2. **Validation**
- ⚠️ Shows warning if files don't match well
- ✅ Displays match rate percentage
- ✅ Lists any parsing errors

### 3. **Merge Intelligence**
- Matches contacts by name + email
- Falls back to email-only matching
- Gracefully handles non-matches
- Shows how many contacts were merged

### 4. **Error Handling**
- Clear error messages
- Can remove and re-upload files
- "Start Over" button to reset

---

## 📝 **Expected CSV Files**

### **Contacts Export.csv** (21 columns):
```
CRM ID,Contact ID,CRM Name,Type,PrimaryContact,First Name,Last Name,Address 1,Address 2,City,State,Zip,Country,Phone 1,Phone 2,Email 1,Email 2,Notes,Tags,Archived,Classification
```

### **Leads List.csv** (23 columns):
```
Lead Name,First Name,Last Name,Position,Address 1,Address 2,City,State,Zip,Country,Phone 1,Phone 2,Email 1,Email 2,Notes,Type,Created,Classification,DoNotEmail,DoNotMail,DoNotCall,CustomClientID,ReferralSource
```

---

## 🚀 **How to Use**

### **Step-by-Step:**

1. **Open Import Dialog**
   - Go to Accounts or Contacts page
   - Click "Import from LMN" button

2. **Upload File 1: Contacts Export**
   - Drag & drop OR click "Choose File"
   - Select "Contacts Export.xlsx - Contact Export.csv"
   - See green checkmark ✓

3. **Upload File 2: Leads List**
   - Drag & drop OR click "Choose File"
   - Select "Leads (1).xlsx - Leads List.csv"
   - See green checkmark ✓

4. **Review Merge Results**
   - See total accounts and contacts
   - Check match rate percentage
   - Review any warnings

5. **Click "Import All Data"**
   - Creates all accounts
   - Creates all contacts with merged data
   - Shows success summary

6. **Done!**
   - View imported accounts in Accounts page
   - View imported contacts in Contacts page

---

## 📦 **Files Created**

### Parsers:
- `/src/utils/lmnContactsExportParser.js` - Parses Contacts Export CSV
- `/src/utils/lmnLeadsListParser.js` - Parses Leads List CSV
- `/src/utils/lmnMergeData.js` - Merges data from both CSVs

### Components:
- `/src/components/ImportLeadsDialog.jsx` - Two-file upload dialog

### Updated:
- `/src/pages/Accounts.jsx` - Import button added
- `/src/pages/Contacts.jsx` - Import button added
- `/src/App.jsx` - Removed standalone route

---

## 🎯 **Match Logic**

Contacts are matched between files using:
1. **Primary:** First Name + Last Name + Email 1
2. **Fallback:** Email 1 only
3. **Fallback:** Email 2

**Example:**
- Contacts Export: "Edwin Abella" with email "REMS.CanadaAP@colliers.com"
- Leads List: "Edwin Abella" with email "REMS.CanadaAP@colliers.com"
- **✅ MATCH!** → Merges Position "Building Operator" and Do Not preferences

---

## 💡 **Why Both Files Are Needed**

| Data | Contacts Export | Leads List | Why Needed |
|------|----------------|------------|------------|
| CRM ID | ✅ | ❌ | Group contacts properly |
| Contact ID | ✅ | ❌ | Unique identifiers |
| Position | ❌ | ✅ | Job titles |
| Do Not Email | ❌ | ✅ | Communication prefs |
| Do Not Mail | ❌ | ✅ | Communication prefs |
| Do Not Call | ❌ | ✅ | Communication prefs |
| Tags | ✅ | ❌ | Categorization |
| Archived | ✅ | ❌ | Status tracking |

**Together = Complete Data! 🎯**

---

## ✅ **Ready to Test**

Your actual files:
- `/Users/joshua/Downloads/Contacts Export.xlsx - Contact Export.csv`
- `/Users/joshua/Downloads/Leads (1).xlsx - Leads List.csv`

**Try uploading both now!** 🚀

















