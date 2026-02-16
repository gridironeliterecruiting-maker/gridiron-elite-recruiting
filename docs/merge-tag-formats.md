# Merge Tag Formats

The system supports ALL of these formats - use whichever you prefer:

## All Formats Work

These are all equivalent and will work:
- `((First Name))` - Title case with spaces ✅ RECOMMENDED
- `((First_Name))` - Title case with underscores
- `((first name))` - Lowercase with spaces  
- `((first_name))` - Lowercase with underscores

## Examples

All of these will be replaced with "Paul":
```
Dear ((First Name))
Dear ((First_Name))
Dear ((first name))
Dear ((first_name))
```

## Special Cases

For "Coach Last Name" after "Dear Coach":
- `Dear Coach ((Last Name))` - Uses the coach's last name
- `((Last Name))` elsewhere - Uses the player's last name

## Full Tag List

All these tags work in any format (spaces/underscores, uppercase/lowercase):
- First Name
- Last Name
- Position
- Grad Year
- High School
- City
- State
- City State
- Phone
- Email
- GPA
- Stats
- Film Link / Hudl URL
- Coach Name
- School / School Name
- Recent Achievement
- Improvement Area
- Recent Game Event
- Recent Performance
- Specific Reason
- All Contact Info