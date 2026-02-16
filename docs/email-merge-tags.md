# Email Merge Tags

## Available Tags

These merge tags are available in email templates:

### Player Information
- `((First Name))` - Player's first name
- `((Last Name))` - Player's last name  
- `((Position))` - Playing position (QB, RB, etc.)
- `((Grad Year))` - Graduation year
- `((High School))` - High school name
- `((City))` - City
- `((State))` - State
- `((City State))` - Combined city, state
- `((Phone))` - Phone number
- `((Email))` - Email address
- `((GPA))` - Grade point average
- `((Stats))` - Basic stats (auto-generated based on position)
- `((Film Link))` - Hudl or highlight film URL

### Coach/School Information
- `((Coach Name))` - Full coach name
- `((Last Name))` - Context-sensitive: Coach's last name after "Coach", player's elsewhere
- `((School))` - College/university name
- `((School Name))` - Same as School

### Other Fields
- `((Recent Achievement))` - Recent accomplishments (TODO)
- `((Improvement Area))` - Areas working on (TODO)
- `((Recent Game Event))` - Recent games/tournaments (TODO)
- `((Recent Performance))` - Recent stats/performance (TODO)
- `((Specific Reason))` - Why interested in this school (TODO)
- `((All Contact Info))` - Combined email and phone

## Special Handling

The system handles "Coach ((Last Name))" specially to use the coach's last name, while standalone ((Last Name)) uses the player's last name.

## Example

Template:
```
Dear Coach ((Last Name)),

My name is ((First Name)) ((Last Name)), and I'm a ((Position)) from ((High School))...
```

Becomes:
```
Dear Coach Smith,

My name is Paul Kongshaug, and I'm a QB from Iowa Valley High School...
```