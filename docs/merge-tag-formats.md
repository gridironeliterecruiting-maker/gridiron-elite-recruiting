# Merge Tag Formats

The system now supports both formats for merge tags:

## With Spaces (Recommended)
```
((First Name))
((Last Name))
((High School))
((Film Link))
```

## With Underscores  
```
((First_Name))
((Last_Name))
((High_School))
((Film_Link))
```

Both formats will work, but we recommend using spaces for readability.

## Special Cases

For "Coach Last Name" after "Dear Coach":
- `Dear Coach ((Last Name))` - Uses the coach's last name
- `((Last Name))` elsewhere - Uses the player's last name

## Full List

All these tags work with either spaces or underscores:
- First Name / First_Name
- Last Name / Last_Name
- Position
- Grad Year / Grad_Year
- High School / High_School
- City
- State
- City State / City_State
- Phone
- Email
- GPA
- Stats
- Film Link / Film_Link
- Coach Name / Coach_Name
- School
- School Name / School_Name