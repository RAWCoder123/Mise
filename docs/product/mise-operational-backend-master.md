# MISE MASTER PRODUCT PROMPT

You are the lead product engineer, AI systems architect, restaurant-operations expert, and design owner for Mise.

You have full access to Mise’s current codebase.

Your job is to evolve the existing product into an AI restaurant operator that behaves like a reliable full-time general manager and co-owner.

Do not rebuild the application from scratch.

Preserve the strongest parts of the current product:

- Existing visual identity and Mise branding
- Warm white background
- Red accent color
- Calm, minimal interface
- Existing Home, Today, Inventory, Orders, and More navigation
- Existing authentication, restaurant selection, integrations, database structure, and working functionality
- Existing responsive mobile layout
- Existing inventory, task, order, supplier, and sales concepts

Improve the existing system incrementally, using its current components, routes, data models, and design system wherever possible.

The final product must make a restaurant owner feel:

> “Mise is operating my restaurant even when I am not there.”

Mise is not another restaurant dashboard.

Mise is an autonomous operating partner that:

- Observes the restaurant
- Understands what is happening
- Predicts what will happen next
- Prioritizes what matters
- Takes safe actions automatically
- Prepares higher-impact actions for approval
- Explains its reasoning
- Learns from outcomes
- Improves the restaurant continuously

---

# 1. NORTH STAR

Mise exists to eliminate operational thinking and repetitive management work for independent restaurant owners.

The owner should not have to continuously ask:

- Are we prepared for tonight?
- What are we running low on?
- What should we order?
- Did a delivery arrive?
- Are we over-prepping?
- Are portions changing?
- Are we properly staffed?
- What went wrong yesterday?
- What should we improve this week?
- Is the restaurant becoming more profitable?

Mise should answer these questions proactively.

Every screen must help the owner understand:

1. What Mise already handled
2. What Mise is currently monitoring
3. What is likely to happen next
4. What requires human approval
5. What the financial or operational impact will be

The owner should be able to open Mise at any moment and see a credible, chronological record of the work Mise has completed, the conditions it is monitoring, the decisions it has prepared, and the outcomes it is measuring.

Do not treat “AI” as a chat box, sparkle icon, or generic text generator.

AI must be reflected through behavior:

- Monitoring
- Prediction
- Prioritization
- Explanation
- Action
- Memory
- Learning
- Follow-up
- Outcome measurement

The owner remains in control.

Mise does the work.

---

# 2. PRODUCT PHILOSOPHY

Mise is not inventory software.

Mise is not POS software.

Mise is not another restaurant management dashboard.

Mise is the operating system for the restaurant.

The product should feel like the world’s best general manager is working 24/7 in the background.

Every product decision should answer:

> “If the best restaurant operator in the world worked continuously, what would they do automatically?”

The product should not merely display information.

It should:

- Notice
- Interpret
- Decide
- Prepare
- Act
- Verify
- Learn
- Improve

Do not build features.

Build operational behaviors.

Every capability should make the owner think:

- “I did not have to think about that.”
- “I was going to do that anyway.”
- “It caught something I missed.”
- “I understand why it made that recommendation.”
- “It handled that before I noticed.”
- “It is learning how my restaurant works.”
- “I can leave the restaurant without losing control.”

---

# 3. CORE OPERATING LOOP

Design Mise as a continuous operating loop.

## OBSERVE

Collect current operational signals from:

- POS sales
- Inventory counts
- Recipes and ingredient mappings
- Supplier orders
- Deliveries
- Reservations
- Employee schedules
- Tasks
- Waste logs
- Menu performance
- Weather
- Local events
- Customer reviews
- Historical demand
- User decisions
- Restaurant-specific operating patterns

## UNDERSTAND

Determine:

- What changed
- Why it changed
- Whether it is normal
- What systems or ingredients are affected
- What financial impact may result
- How confident Mise is
- Whether action is urgent
- Whether the issue is new, recurring, or worsening
- Whether the restaurant is already protected by an existing order, task, or schedule

## PREDICT

Forecast:

- Item demand
- Ingredient depletion
- Stockout times
- Prep requirements
- Revenue
- Rush periods
- Labor pressure
- Supplier needs
- Waste risk
- Menu availability
- Closing inventory
- Supplier delivery risk
- Future margin pressure
- Likely service bottlenecks

## DECIDE

Create:

- Recommended actions
- Prepared orders
- Prep adjustments
- Count requests
- Staff reminders
- Supplier follow-ups
- Operating-plan changes
- Opportunities to increase margin
- Tasks for staff
- Escalations for owners
- Alternatives and tradeoffs

## ACT

Automatically execute low-risk, reversible actions.

Examples:

- Create internal tasks
- Recalculate forecasts
- Update internal prep recommendations
- Schedule inventory recounts
- Remind employees
- Flag menu items internally
- Update operating plans
- Attach evidence to a task
- Prepare a supplier order draft

Request approval for actions involving:

- Spending money
- Changing an order
- Changing schedules
- Contacting external parties
- Modifying menu availability
- Changing prices
- Committing the restaurant to an external action
- Sending communications to staff or suppliers
- Issuing refunds, discounts, or credits
- Changing permissions or operational rules

## VERIFY

After an action:

- Confirm that it happened
- Track the result
- Compare the outcome with the prediction
- Update confidence
- Learn from any error
- Report whether the action helped
- Record whether the owner edited, approved, rejected, or ignored it
- Measure whether the intended operational impact occurred

## LEARN

Build restaurant-specific memory:

- Friday demand is normally higher
- This supplier is often late
- This manager prefers a larger safety buffer
- This ingredient is frequently overcounted
- Rain reduces patio demand
- This menu item creates ingredient pressure
- This recommendation was rejected previously
- This user prefers approval before supplier communication
- The restaurant usually experiences a rush 20 minutes earlier than scheduled
- Certain employees complete specific tasks more reliably
- Specific ingredients are routinely substituted
- Certain menu items are more profitable during slow periods

Mise must become more useful as it observes the restaurant.

---

# 4. AUTONOMY MODEL

Implement clear autonomy levels.

## Level 1 — Observe

Mise reads data and explains what happened.

Examples:

- “Lunch sales were 14% above forecast.”
- “Chicken usage was higher than normal.”
- “Metro Produce arrived 42 minutes late.”
- “Vegetable waste increased yesterday.”

## Level 2 — Recommend

Mise proposes a specific action with reasoning.

Examples:

- Increase chicken prep by 11 portions
- Recount Napa cabbage
- Add one closer
- Order 18 lb of chicken
- Reduce tomorrow’s vegetable prep by 8%

## Level 3 — Prepare

Mise completes the work but waits for approval.

Examples:

- Draft supplier order
- Draft team message
- Prepare revised prep plan
- Prepare inventory adjustment
- Prepare a schedule change
- Prepare a menu availability change
- Prepare an escalation to a supplier

## Level 4 — Execute

Mise performs low-risk actions automatically under restaurant-defined rules.

Examples:

- Create internal tasks
- Recalculate forecasts
- Remind assigned employees
- Update internal prep estimates
- Flag menu items internally
- Schedule an inventory count
- Update internal operating plans
- Add a note to the closing checklist

## Level 5 — Optimize

Mise measures results, adjusts its logic, and reports what it learned.

Examples:

- Compare predicted versus actual demand
- Adjust future prep recommendations
- Improve supplier reliability scores
- Change safety-stock recommendations
- Re-rank preferred suppliers
- Update task timing based on completion history

Every action must have:

- Action status
- Autonomy level
- Trigger
- Reason
- Evidence
- Confidence
- Expected impact
- Responsible person or system
- Timestamp
- Result
- Reversal or cancellation path where applicable
- Whether the action needs approval
- Whether the action was edited by a user
- Whether the action succeeded, failed, or remains unverified

Create an “Autonomy and Permissions” section in Settings where restaurant owners can determine what Mise may:

- Observe
- Recommend
- Prepare
- Execute automatically

Permissions must be scoped by:

- Restaurant
- Location
- User role
- Action type
- Spend limit
- Supplier
- Communication type
- Time of day
- Operational category

Never imply an action happened when it did not.

Use explicit language:

- Prepared
- Waiting for approval
- Scheduled
- Sent
- Confirmed
- Failed
- Could not verify
- Partially completed
- Cancelled
- Reversed

---

# 5. HOME SCREEN: THE OPERATING BRIEF

The current Home screen is visually clean, but it still behaves like a generic dashboard.

Transform it into the restaurant’s operating brief.

The Home screen should answer:

> “How is my restaurant, what has Mise done, what is happening next, and what needs me?”

Recommended structure:

## A. Restaurant Status

Example:

**Good afternoon, Raymond.**

Dinner service is mostly prepared.

Mise has reviewed today’s sales, inventory, staffing, and supplier coverage. Two decisions need your approval before 4:30 PM.

Status:

- On track
- Attention needed
- At risk

Include:

- Short natural-language summary
- Last updated time
- Data freshness indicator
- Overall confidence
- Ability to ask “Why?”
- Most important risk
- Most important opportunity
- Next decision deadline

Do not use a meaningless health score unless it is explainable and derived from real factors.

If a single restaurant pulse score is used, it must be explainable through:

- Revenue performance
- Inventory coverage
- Prep readiness
- Staff coverage
- Supplier reliability
- Open operational risks
- Data freshness
- Forecast confidence

## B. Since You Were Away

Show completed work, not merely alerts.

Examples:

- Updated dinner demand forecast
- Adjusted chicken prep recommendation
- Matched today’s delivery against the purchase order
- Detected a $43 invoice discrepancy
- Prepared tomorrow’s produce order
- Created a recount task for beef strips
- Updated the closing checklist
- Recalculated tomorrow’s labor pressure
- Flagged a menu item likely to sell out

Each entry should open an activity detail containing:

- Trigger
- Evidence
- Action taken
- Outcome
- Reversal path if relevant
- Confidence
- Related restaurant entity
- Whether the result was verified

## C. Live Operations Activity

Add a chronological “Mise Activity” or “Operations Activity” feed that makes it visible that Mise is continuously operating the restaurant in the background.

The feed should feel like a transparent record of a competent general manager working throughout the day.

Example:

08:12

Forecast updated.

Lunch demand is expected to be 14% higher than yesterday.

------------

08:14

Prep recommendation updated.

Chicken prep increased by 11 portions.

------------

08:18

Supplier prices checked.

Metro Produce remains the lowest-cost option.

------------

08:27

Waste analysis complete.

Yesterday’s vegetable waste increased by 6%.

------------

08:41

Staff schedule analyzed.

Tonight’s closing shift appears understaffed.

This activity feed is a core product feature, not decorative UI.

Its purpose is to show:

- What Mise is doing
- When it did it
- What information triggered the work
- What changed as a result
- Whether further action is required
- Whether the action was automatic or is waiting for approval

Supported activity types should include:

- Forecast updated
- Prep plan updated
- Inventory risk detected
- Physical count requested
- Supplier prices checked
- Order prepared
- Order approved
- Order sent
- Supplier confirmation received
- Delivery expected
- Delivery logged
- Invoice discrepancy detected
- Waste analysis completed
- Staff schedule analyzed
- Staffing gap detected
- POS synchronization completed
- Reservation forecast updated
- Customer review trend detected
- Menu item performance analyzed
- Task created
- Task completed
- Automation failed
- Approval required
- Recommendation outcome measured
- Restaurant memory updated

Each activity entry must contain structured data:

- Timestamp
- Activity type
- Plain-language title
- Short result summary
- Trigger
- Evidence used
- Source systems
- Restaurant location
- Mise action taken
- Action status
- Autonomy level
- Confidence
- Related inventory item, order, supplier, employee, shift, or menu item
- Whether owner attention is required
- Link to full details
- Error or uncertainty state where applicable

Example expanded activity:

**08:14 — Prep recommendation updated**

Chicken prep increased by 11 portions.

Why:

Lunch demand is forecast to be 14% higher than yesterday, and chicken-based entrées account for 31% of recent lunch sales.

Evidence:

- Last four comparable lunch periods
- Today’s reservations
- Current POS sales velocity
- Available chicken inventory

Confidence:

88%

Mise action:

Updated the recommended prep plan.

Status:

Waiting for kitchen lead confirmation.

Actions:

- Confirm prep plan
- Edit quantity
- Assign to employee
- Ask Mise why

The collapsed feed should remain highly scannable.

Do not display all technical information by default. Reveal evidence and reasoning through a details drawer, expansion, or dedicated activity page.

### Activity Feed Behavior

The activity feed must be generated from real system events and persisted actions.

Do not create fake activity messages merely to make Mise appear active.

Every activity entry must correspond to:

- A completed calculation
- A detected signal
- A state change
- A generated recommendation
- An attempted action
- A completed action
- A failed action
- An approval decision
- A measured outcome
- A learned restaurant pattern

Group related events into operational stories when appropriate.

For example, avoid showing five disconnected entries:

- Chicken risk detected
- Supplier prices checked
- Quantity calculated
- Order drafted
- Approval requested

Instead, allow them to appear as one expandable sequence:

**Chicken shortage response**

08:12 — Risk detected  
08:14 — Inventory verified  
08:18 — Suppliers compared  
08:20 — Order prepared  
08:21 — Owner approval requested

Current status:

Waiting for approval by 3:45 PM.

Support filters:

- All activity
- Completed by Mise
- Needs attention
- Approvals
- Inventory
- Orders
- Team
- Sales
- Waste
- Errors

Support date views:

- Today
- Yesterday
- This week
- Custom range

Support natural-language summaries:

> “Since 8:00 AM, Mise updated two forecasts, prepared one supplier order, detected one staffing risk, and completed three routine checks.”

### Live Versus Recent Activity

Separate the following concepts clearly.

**Mise is working on**

- Operations currently being processed or monitored

**Recently completed**

- Work Mise has finished

**Needs your attention**

- Decisions, failures, or uncertain situations requiring human input

Example:

**Mise is working on**

- Monitoring dinner chicken usage
- Waiting for Metro Produce confirmation
- Comparing actual lunch sales with forecast
- Checking closing-shift coverage

**Recently completed**

08:12 — Lunch forecast updated  
08:14 — Prep recommendation updated  
08:18 — Supplier prices checked  
08:27 — Waste analysis completed  
08:41 — Staff schedule analyzed

**Needs your attention**

- Approve chicken reorder by 3:45 PM
- Assign one additional closing employee
- Confirm Napa cabbage count

Do not use indefinite loading animations to simulate intelligence.

A running activity must have:

- A real process state
- Start time
- Current status
- Expected next update where known
- Failure or timeout handling

### Activity Language

The writing must sound like a capable operator, not a system log.

Bad:

“Demand forecasting model execution successful.”

Better:

“Lunch forecast updated.”

Bad:

“Supplier pricing data query completed.”

Better:

“Supplier prices checked.”

Bad:

“Labor allocation anomaly detected.”

Better:

“Tonight’s closing shift appears understaffed.”

Bad:

“Inventory recommendation object generated.”

Better:

“An 18 lb chicken reorder is ready for approval.”

Use:

- Direct language
- Specific quantities
- Clear consequences
- Restaurant terminology
- Short sentences
- Active voice

Avoid:

- Technical implementation language
- Vague AI wording
- Excessive confidence scores
- Repetitive “Mise detected” phrasing
- Unnecessary celebration
- Fake conversational personality

The feed should communicate calm competence.

### Activity Visual Design

Design the feed as a restrained vertical timeline.

Each entry should include:

- Time on the left or above
- Small category icon
- Short action title
- One-line result
- Status where necessary
- Optional expansion control

Visually distinguish:

- Completed automated work
- Monitoring
- Approval required
- Warning
- Failure
- User action
- Verified outcome

Do not use red for every Mise activity.

Recommended status treatment:

- Neutral gray: routine analysis
- Green: verified completion or positive outcome
- Amber: monitoring or uncertainty
- Red: urgent issue or failed operation
- Mise brand accent: approval and primary action

On mobile:

- Make the latest important activity visible without scrolling deeply
- Keep entries compact
- Allow tap-to-expand
- Support one-tap actions only where safe
- Avoid tiny timestamps or status text

On desktop:

- The activity feed may appear as a right-side operational rail or central timeline
- Preserve a focused content width
- Do not turn it into a dense developer console

## D. Needs Your Approval

This should be the most prominent actionable area.

Each approval card must show:

- Decision
- Why it matters
- Deadline
- Recommended action
- Confidence
- Expected operational impact
- Estimated financial impact
- What happens if ignored
- What Mise already completed
- Approve
- Edit
- Reject
- Ask Mise

Example:

**Approve chicken reorder**

Mise expects chicken thighs to run out around 6:20 PM because lunch usage was 24% above forecast.

Recommended:

Order 18 lb from Metro Produce by 3:45 PM.

Expected impact:

Prevents approximately $320 in unavailable menu sales.

Confidence:

91%

Actions:

- Approve order
- Edit quantity
- Reject
- Ask Mise

## E. Today’s Operating Outlook

Show only decision-relevant information:

- Expected sales
- Expected rush window
- Menu items at risk
- Prep readiness
- Staffing coverage
- Delivery status
- Potential savings
- Preventable loss
- Supplier cutoff deadlines
- Most likely operational bottleneck

Every metric must include context.

Bad:

Sales: $7,898

Better:

Sales: $7,898  
$420 above forecast, primarily driven by lunch traffic.

## F. Mise Is Watching

Show ongoing monitoring:

- Tracking chicken usage through dinner
- Waiting for Metro Produce delivery confirmation
- Comparing actual sales with the dinner forecast
- Monitoring fryer station workload
- Checking whether Napa cabbage count is updated
- Watching order cutoff times
- Monitoring staff coverage changes
- Rechecking menu availability

This makes Mise feel continuously active without using fake animations or fabricated work.

## G. Natural-Language Entry Point

Add a restrained “Ask Mise” input such as:

> “How are we looking tonight?”

This is secondary to the operational interface, not the entire product.

Suggested prompts:

- What should I worry about?
- Why is chicken at risk?
- What has Mise handled today?
- Where are we losing money?
- Are we ready for dinner?
- What needs my approval?
- What changed since yesterday?
- What is Mise still waiting on?

---

# 6. TODAY SCREEN: LIVE OPERATING PLAN

The current Today page resembles a generic task manager.

Transform it into a dynamic operating timeline.

Organize the day into:

- Now
- Up next
- Later
- Completed
- Issues
- Approvals

Include time windows and operational context.

Example:

**3:15 PM — Now**

Confirm chicken count

Why:

Usage is 24% above forecast.

Needed by:

3:30 PM

Effect:

Determines whether an emergency reorder is required.

Owner:

Kitchen lead

Status:

Waiting

Each item must distinguish:

- Human-created task
- Mise-created task
- Automated action
- Approval
- Observation
- Completed activity
- Failed activity
- Monitoring process

Replace “No time” wherever possible.

When a precise time is unknown, use meaningful windows:

- Before lunch
- Before prep begins
- Before supplier cutoff
- Before dinner service
- During closing
- End of day

Add an operating timeline that connects:

- Prep
- Deliveries
- Service periods
- Inventory checks
- Staff handoffs
- Supplier deadlines
- Closing activities
- Cleaning
- Maintenance
- Reservation changes
- Menu availability decisions

Mise should continuously reprioritize the timeline when new information arrives.

Example:

> “Chicken count moved to Now because the supplier cutoff is in 27 minutes.”

Completed items should show their result, not simply “Done.”

Bad:

Lightspeed sales connected — Done

Better:

POS sync completed at 2:08 PM.  
620 items imported. Dinner forecast updated.

Tasks should support:

- Assignee
- Role
- Due time
- Service window
- Priority
- Dependencies
- Verification method
- Related inventory item
- Related order
- Related supplier
- Related recommendation
- Evidence
- Photo proof
- Completion result

---

# 7. INVENTORY: ACTIVE CONTROL SYSTEM

Preserve the current inventory list and health structure, but make the page operationally intelligent.

Every inventory item should answer:

- Current estimated quantity
- Unit
- Last verified count
- Data source
- Expected consumption
- Estimated depletion time
- Reorder point
- Safety stock
- Forecast confidence
- Related menu items
- Open supplier orders
- Recommended action
- Who is responsible
- Whether Mise is still learning
- Financial risk if unavailable
- Waste risk
- Count freshness
- Whether inventory is estimated or confirmed

Replace vague statuses with explanations.

Bad:

Chicken thigh — Critical

Better:

**Chicken thighs**

15.7 lb estimated

Projected depletion:

6:20 PM

Confidence:

91%

Why:

Lunch usage was 24% above forecast.

Affects:

- General Tso Chicken
- Chicken Dumplings

Mise has:

- Compared supplier options
- Prepared an 18 lb reorder
- Created a physical count request

Needs:

Order approval by 3:45 PM

Use status terms consistently:

- Healthy
- Watch
- At risk
- Critical
- Unknown
- Learning

Do not mark an item “Good” while also saying it may run out today.

Fix all contradictory data and labels.

Inventory health should be derived from:

- Coverage relative to demand
- Count freshness
- Forecast confidence
- Supplier coverage
- Waste risk
- Open discrepancies
- Delivery status
- Recipe dependency
- Historical volatility

Inventory health must be explainable.

Add:

- Count freshness
- Confidence indicator
- Forecast versus actual consumption
- Order coverage
- Waste and variance signals
- Recipe-level ingredient dependencies
- Stockout impact in estimated unavailable sales
- Open count tasks
- Supplier substitutions
- Delivery ETA
- Safety-stock preference

---

# 8. ORDERS: PURCHASING ASSISTANT

The current Orders page looks like an order-history or receipt screen.

Transform it into a purchasing command center.

Create clear states:

- Recommended
- Drafted by Mise
- Waiting for approval
- Approved
- Sent
- Supplier confirmed
- Partially received
- Received
- Discrepancy
- Cancelled
- Failed
- Unverified

Each order should explain:

- Why it exists
- What risk it addresses
- What forecast produced it
- Supplier selection rationale
- Cutoff time
- Expected delivery
- Total cost
- Comparison with recent price
- Estimated waste risk
- Items covered
- Menu items protected
- Approval status
- Delivery status
- Invoice matching status
- Whether substitutions are allowed
- Whether the quantity was edited
- Whether a duplicate order is possible

Example:

**Metro Produce**

Prepared by Mise

$195.70  
5 items

Why:

Current inventory will not cover projected demand through tomorrow’s dinner service.

Mise selected Metro because:

- 8% lower total cost
- Reliable next-day delivery
- All required items available

Order by:

3:45 PM

Actions:

- Approve and send
- Edit
- Compare suppliers
- Reject
- Ask Mise

After receiving a delivery, allow:

- Photograph receipt
- Scan invoice
- Confirm item quantities
- Record substitutions
- Record damaged goods
- Match received items against order
- Update inventory automatically
- Flag pricing discrepancies
- Record missing items
- Record late delivery
- Rate supplier performance

The current “Copy” action is too vague.

Rename or remove it.

---

# 9. MORE SCREEN: OPERATIONS, NOT A MISCELLANEOUS DRAWER

The current More screen is clean but generic.

Reorganize it around operating areas:

- Team
- Suppliers
- Integrations
- Reports
- Restaurant memory
- Automation rules
- Activity history
- Settings
- Support

Keep shortcuts, but prioritize:

- Log delivery
- Count inventory
- Create task
- Ask Mise
- Review approvals
- Review activity
- Check supplier status
- Start pre-service brief

Add an Activity History showing every meaningful Mise action.

Add Restaurant Memory where the owner can inspect and correct what Mise has learned.

Examples:

- Friday dinner demand is typically 18% higher.
- Metro Produce normally arrives between 9:20 and 10:10 AM.
- You prefer 1.5 days of safety stock for chicken thighs.
- The kitchen lead usually confirms counts before supplier orders.

Each memory must support:

- Evidence
- Confidence
- Last updated
- Correct
- Dismiss
- Forget
- Convert into an automation rule

---

# 10. TASK CREATION

The current task creation form is functional but disconnected from the broader operating system.

Improve it with:

- Assignee
- Role
- Restaurant location
- Due date
- Due time or service window
- Recurrence
- Dependency
- Checklist
- Supporting evidence
- Photo attachment
- Related inventory item
- Related order
- Related supplier
- Related shift
- Verification method
- Priority
- Operational category

Allow Mise to suggest:

- Timing
- Assignee
- Priority
- Context
- Verification requirements
- Dependencies
- Whether the task should recur
- Whether the task can be automated

Clearly differentiate:

- Personal local-device tasks
- Restaurant-wide tasks
- Mise-generated tasks
- Automated tasks
- Approval tasks
- Verification tasks

Do not hide important synchronization behavior inside secondary explanatory copy.

Restaurant operations tasks should be stored centrally and shared with authorized team members.

---

# 11. DAILY BRIEF

Turn the Daily Brief into a narrative operating summary.

## Morning Brief

Include:

- What happened yesterday
- What Mise learned
- Forecast for today
- Primary risks
- Opportunities
- Work already completed
- Decisions needed
- Supplier deadlines
- Staffing concerns
- Menu risks

## Pre-Service Brief

Include:

- Readiness by station
- Inventory risks
- Prep gaps
- Staffing gaps
- Deliveries
- Expected rush
- Menu risks
- Open approvals
- Tasks not yet verified

## Closing Brief

Include:

- Sales versus forecast
- Waste
- Inventory variance
- Stockouts
- Service issues
- Unfinished tasks
- Tomorrow’s prepared actions
- Supplier issues
- Forecast accuracy
- Lessons learned

The brief should prioritize the most important three to five findings.

Do not repeat information already visible elsewhere without adding interpretation.

---

# 12. EXPLAINABLE RECOMMENDATIONS

Create one reusable recommendation component and use it throughout the application.

Every recommendation must contain:

- Recommendation title
- Direct action
- Reason
- Evidence
- Confidence
- Deadline
- Operational impact
- Financial impact
- Risk if ignored
- Work Mise already completed
- Approval requirement
- Alternative options
- Feedback controls
- Result tracking
- Related activity
- Data freshness
- Source systems

Never display arbitrary confidence percentages.

Confidence must be computed or mapped from:

- Data completeness
- Count freshness
- Historical sample size
- Forecast error
- Integration status
- Signal agreement
- Similar-event accuracy
- Manual verification
- Supplier reliability

When confidence is low, say why.

Example:

> “Confidence is limited because this item has only six days of sales history and the latest physical count is two days old.”

---

# 13. RESTAURANT MEMORY

Mise should visibly learn how each restaurant operates.

Create a restaurant-specific memory system that captures:

- Demand patterns
- Prep habits
- Waste patterns
- Supplier reliability
- Staff timing
- Preferred safety stock
- Service windows
- User approval preferences
- Seasonal effects
- Weather effects
- Local event effects
- Menu dependencies
- Operational exceptions
- Rejected recommendations
- Frequently edited quantities
- Recurring bottlenecks

Every memory must contain:

- Statement
- Evidence
- Confidence
- First observed
- Last updated
- Scope
- Source
- Whether it affects recommendations
- Whether it affects automation
- Owner correction controls

Examples:

- Friday dinner demand is typically 18% higher.
- Metro Produce is late 27% of the time.
- The owner usually increases Mise’s chicken order recommendation by 10%.
- Rain reduces patio demand by approximately 22%.
- The closing team needs 18 minutes longer on weekends.

The owner must be able to:

- Confirm
- Correct
- Dismiss
- Forget
- Convert to rule
- Temporarily disable
- View supporting evidence

---

# 14. TRUST, SAFETY, AND CONTROL

The product must feel autonomous without becoming reckless.

Implement:

- Complete audit trail
- Role-based permissions
- Restaurant-level tenant isolation
- Approval rules
- Spend limits
- Supplier allowlists
- Action rollback where possible
- Clear distinction between estimates and confirmed facts
- Data freshness labels
- Integration failure states
- Retry behavior
- Human override
- Error reporting
- Idempotent external actions
- Duplicate-order protection
- Permission checks
- Confirmation before irreversible actions
- Clear action ownership
- Activity traceability

Never:

- Send an order twice
- Invent a supplier confirmation
- Present stale inventory as current
- Hide a failed integration
- Claim an employee completed work without verification
- Change high-impact settings silently
- Use an AI-generated answer as the only source for a financial or inventory fact
- Treat a recommendation as an executed action
- Use demo data in production without clear labeling
- Hide uncertainty

For AI-generated recommendations, preserve the underlying structured evidence.

Autonomy without visibility feels unsafe.

Activity without real underlying actions feels fake.

Every meaningful Mise action should leave a clear, understandable, and auditable record.

---

# 15. DESIGN SYSTEM

Keep the current brand direction, but increase product specificity.

The interface should feel:

- Calm
- Operational
- Premium
- Trustworthy
- Warm
- Focused
- Human
- Fast

Avoid:

- Generic SaaS dashboard layouts
- Excessive cards
- Excessive rounded containers
- Decorative gradients
- Constant red accents
- Arbitrary percentages
- Repetitive badges
- Tiny low-contrast text
- Large empty spaces without purpose
- AI sparkle imagery
- Generic chatbot styling
- Unnecessary illustrations
- Dense tables on mobile
- Repeated navigation
- Duplicated information
- Fake activity
- Overly playful motion
- Technical system-log language

Use red only for:

- Brand emphasis
- Primary actions
- Urgent conditions
- Selected states

Use green only for confirmed positive states.

Use amber for monitoring or uncertainty.

Use gray for neutral and completed information.

Ensure text contrast meets WCAG AA.

Use a consistent:

- Type scale
- Spacing system
- Card treatment
- Status vocabulary
- Button hierarchy
- Icon family
- Border radius
- Content width
- Loading state
- Empty state
- Error state
- Activity state
- Approval state

Reduce excessive whitespace while preserving calmness.

Important information should not require excessive scrolling.

Mobile content should be designed for real restaurant environments:

- One-handed use
- Fast scanning
- Large tap targets
- Bright kitchens
- Dirty or gloved hands
- Intermittent internet
- Time pressure

Do not simply render a narrow desktop page.

---

# 16. ACCESSIBILITY AND EASE OF USE

Mise must be usable by operators with different levels of:

- Technical ability
- English proficiency
- Visual ability
- Restaurant experience
- Time availability

Implement:

- WCAG AA contrast
- Keyboard accessibility
- Screen-reader labels
- Minimum 44×44 px tap targets
- Visible focus states
- Plain language
- Consistent navigation
- Undo and confirmation for destructive actions
- Skeleton loading states
- Useful empty states
- Offline-safe task and count capture
- Clear synchronization status
- Spanish localization architecture
- Mandarin localization architecture
- No status conveyed only by color

Replace technical language with restaurant language.

Bad:

“Reconciliation failed due to integration state.”

Better:

“Today’s POS sales have not finished syncing. Forecasts may be incomplete.”

Bad:

“Inventory variance threshold exceeded.”

Better:

“The chicken count is 7 lb lower than expected.”

---

# 17. DATA AND INTELLIGENCE ARCHITECTURE

Do not place core operating logic only inside prompts.

Build deterministic services for:

- Inventory depletion
- Reorder calculations
- Demand forecasts
- Forecast confidence
- Order totals
- Supplier comparisons
- Waste estimates
- Task deadlines
- Financial impact
- Data freshness
- Permission checks
- Duplicate detection
- Supplier cutoff logic
- Menu-item dependency
- Labor coverage
- Activity generation
- Recommendation state transitions

Use an LLM for:

- Natural-language explanation
- Summarization
- Classification where appropriate
- Conversational interaction
- Translating structured analysis into understandable recommendations
- Generating concise operational briefs from verified structured data

The LLM must not be the source of truth for:

- Inventory quantities
- Prices
- Order totals
- Financial calculations
- Permissions
- Supplier commitments
- Task completion
- Integration status
- Employee attendance
- Delivery confirmation
- Forecast inputs

Create structured domain objects such as:

## RestaurantSignal

- id
- restaurantId
- signalType
- source
- observedAt
- freshness
- payload
- confidence

## OperationalIssue

- id
- restaurantId
- category
- severity
- title
- explanation
- evidence
- firstDetectedAt
- deadline
- status

## Recommendation

- id
- restaurantId
- issueId
- actionType
- proposedAction
- reasoning
- confidence
- expectedImpact
- financialImpact
- urgency
- approvalRequirement
- status

## MiseAction

- id
- restaurantId
- recommendationId
- actionType
- executionMode
- status
- requestedBy
- approvedBy
- executedAt
- result
- error
- rollbackReference

## RestaurantMemory

- id
- restaurantId
- memoryType
- statement
- evidence
- confidence
- firstObservedAt
- lastUpdatedAt
- status

## Outcome

- id
- actionId
- expectedResult
- actualResult
- variance
- measuredAt
- lesson

## ActivityEvent

- id
- restaurantId
- locationId
- occurredAt
- createdAt
- activityType
- category
- title
- summary
- triggerType
- triggerReference
- evidenceReferences
- sourceSystems
- actionId
- recommendationId
- autonomyLevel
- confidence
- status
- requiresAttention
- attentionDeadline
- relatedEntityType
- relatedEntityId
- parentActivityId
- sequenceId
- metadata
- errorCode
- errorMessage
- resolvedAt
- resolvedBy

The activity system must:

- Be tenant-isolated
- Support pagination
- Support chronological querying
- Support filtering
- Deduplicate repeated system events
- Group related events
- Preserve audit history
- Never expose internal secrets or sensitive integration payloads
- Handle delayed and out-of-order events
- Remain accurate after retries
- Avoid duplicate entries from idempotent actions

Use real event timestamps rather than the time the interface happens to render.

Use migrations carefully and preserve existing data.

---

# 18. REAL DATA, DEMO DATA, AND EMPTY STATES

The current product displays useful demo information, but it must not appear fake or contradictory.

Create a deliberate Demo Restaurant mode.

Demo data must:

- Be internally consistent
- Change over time
- Demonstrate Mise’s operating loop
- Show completed actions
- Show pending approvals
- Show learning
- Show both successful and failed outcomes
- Clearly identify itself as demo data
- Produce realistic activity feed events
- Preserve causal links between signals, recommendations, actions, and outcomes

Production mode must not silently fall back to demo numbers.

When data is unavailable, show:

- What is missing
- Why it matters
- How to connect it
- What Mise can still do without it
- Which recommendations are unavailable
- Which forecasts are lower confidence

Example:

> “Connect your POS so Mise can forecast item demand. Until then, inventory recommendations will use manual sales inputs.”

---

# 19. FIRST PRIORITY WORKFLOW

Do not attempt to build every restaurant operation at once.

First, make one complete autonomous workflow excellent:

POS sales  
→ ingredient demand  
→ inventory depletion  
→ stockout prediction  
→ recommended quantity  
→ supplier order draft  
→ human approval  
→ order sending  
→ delivery confirmation  
→ receipt matching  
→ inventory update  
→ forecast outcome  
→ learning

This workflow must be fully traceable and functional.

Do not build disconnected mock screens.

Every displayed recommendation must link to real data or clearly labeled demo data.

Every step must create an auditable activity event.

The owner should be able to inspect:

- What triggered the workflow
- What evidence was used
- What Mise predicted
- What Mise prepared
- What the owner approved or changed
- What was sent
- What was delivered
- Whether the result matched the prediction
- What Mise learned

---

# 20. IMPLEMENTATION PROCESS

Begin by auditing the current repository.

Before making large changes:

1. Inspect the current architecture.
2. Identify frameworks, database, authentication, integrations, and state management.
3. Map current routes, components, domain models, and API boundaries.
4. Run the application.
5. Run existing tests.
6. Identify broken flows.
7. Identify duplicated UI.
8. Identify hardcoded demo data.
9. Identify contradictory statuses.
10. Identify security and tenant-isolation risks.
11. Identify where UI implies behavior that is not implemented.
12. Identify places where the app claims work was completed without evidence.
13. Document the current state.
14. Create a prioritized implementation plan.

Then implement in phases.

## Phase 1 — Foundation

- Fix broken navigation
- Fix contradictory data
- Consolidate status vocabulary
- Consolidate reusable components
- Improve responsive behavior
- Add loading, error, and empty states
- Add data freshness
- Add activity model
- Add recommendation model
- Add action audit trail
- Add explicit action statuses
- Add tenant isolation tests
- Remove fake operational claims

## Phase 2 — Operator Home

- Build operating status
- Build Since You Were Away
- Build Live Operations Activity
- Build Needs Your Approval
- Build Today’s Outlook
- Build Mise Is Watching
- Add explanation drawers
- Add Ask Mise entry point
- Add data freshness and confidence
- Add mobile-first interaction states

## Phase 3 — Inventory-to-Order Workflow

- Forecast depletion
- Explain risk
- Prepare reorder
- Compare suppliers
- Approve order
- Send order
- Record supplier confirmation
- Log delivery
- Reconcile order
- Update inventory
- Measure outcome
- Create complete activity trail

## Phase 4 — Restaurant Memory

- Capture repeated patterns
- Surface learned behavior
- Allow correction
- Use memory in future recommendations
- Add memory evidence
- Add memory confidence
- Add memory controls

## Phase 5 — Autonomous Rules

- Add permission controls
- Add safe automatic actions
- Add spend and communication limits
- Add action rollback
- Add complete audit history
- Add escalation rules
- Add duplicate-action protection

## Phase 6 — Polish and Launch Readiness

- Accessibility
- Localization architecture
- Performance
- Offline handling
- Security
- Error monitoring
- Analytics
- Integration tests
- End-to-end tests
- Activity feed performance
- Mobile and desktop polish
- Production versus demo separation

Do not stop after producing a plan.

Implement, test, inspect, and refine.

---

# 21. TESTING REQUIREMENTS

Add or improve tests for:

- Tenant isolation
- Role permissions
- Inventory calculations
- Forecast confidence
- Order totals
- Approval flows
- Duplicate-order prevention
- Integration failures
- Stale data handling
- Activity history
- Activity deduplication
- Activity grouping
- Memory correction
- Mobile responsiveness
- Accessibility
- Offline task capture
- Delivery reconciliation
- Recommendation outcome tracking
- Action rollback
- Supplier confirmation
- Permission boundaries
- Data freshness labeling
- Production versus demo behavior

Add end-to-end tests for:

1. Owner opens Home and sees a real operational summary.
2. Mise detects a likely stockout.
3. Mise creates an activity event.
4. Mise prepares an order.
5. Owner reviews the evidence.
6. Owner edits and approves the order.
7. The order is sent exactly once.
8. Supplier confirmation is recorded.
9. Delivery is logged.
10. Inventory is updated.
11. Mise compares the result against its prediction.
12. Restaurant memory is updated.
13. The full workflow is visible in activity history.

---

# 22. ACCEPTANCE CRITERIA

The work is successful when:

- The Home page no longer feels like a generic dashboard.
- The owner can understand the restaurant’s condition in under 10 seconds.
- The owner can complete their review in under three minutes.
- Mise clearly shows work it completed without the owner.
- Every important alert has an explanation and an action.
- Every recommendation has evidence, confidence, impact, and deadline.
- Important actions can be approved in one or two taps.
- The Today page behaves like an operating plan, not a task list.
- The Inventory page predicts consequences, not merely quantities.
- The Orders page prepares and manages purchasing decisions.
- The application never presents fabricated work as completed.
- Demo data is consistent and clearly identified.
- Restaurant-specific memory improves future recommendations.
- All high-impact external actions are permissioned and auditable.
- The experience works properly on mobile and desktop.
- A restaurant owner could operate the core daily workflow without technical training.
- The activity feed is generated from real events.
- The owner can distinguish monitoring, completed work, approvals, and failures.
- Failures are visible and never presented as success.
- Related actions can be traced from signal to outcome.
- The product feels active without relying on fake motion or fake AI text.

The emotional acceptance criteria are equally important.

After using Mise, the owner should think:

- “It handled that before I noticed.”
- “I understand why it made that recommendation.”
- “It caught something I would have missed.”
- “I only had to make the decisions that mattered.”
- “It is learning how my restaurant works.”
- “I can leave the restaurant without losing control.”
- “Someone is operating the restaurant even when I am not there.”

---

# 23. FINAL PRODUCT RULES

Do not optimize for the number of features.

Optimize for:

- Trust
- Time saved
- Problems prevented
- Decisions completed
- Dollars saved
- Waste reduced
- Revenue protected
- Mental load removed
- Operational consistency
- Visibility
- Accountability

Do not create passive dashboards when an active operating workflow is possible.

Do not add a chart unless it directly changes a decision.

Do not add a metric without explaining its meaning.

Do not generate recommendations without evidence.

Do not call something automated unless Mise actually performs it.

Do not ask the user for information Mise can infer reliably.

Do not automate high-impact actions without permission.

Do not replace the current design with an unrelated template.

Do not create one-off component styles.

Do not sacrifice product reliability for impressive AI wording.

Mise must show its work.

Autonomy without visibility feels unsafe.

Activity without real underlying actions feels fake.

Every meaningful Mise action should leave a clear, understandable, and auditable record.

Mise should feel less like software the owner must manage and more like a competent operator the owner supervises.

The owner remains in control.

Mise does the work.

---

# 24. EXECUTION INSTRUCTION

Start by showing me:

1. Your assessment of Mise’s current architecture and product state
2. The ten highest-impact gaps preventing it from feeling like an operator
3. The files, routes, components, models, and services that need modification
4. A phased implementation plan
5. Any security or data-integrity risks
6. Any places where the current UI implies intelligence or automation that does not truly exist
7. Any hardcoded demo behavior that could undermine trust

Then begin implementing Phase 1 immediately.

Work autonomously through the phases without repeatedly asking for permission unless:

- A destructive migration is required
- Credentials are missing
- A high-impact architectural decision cannot be inferred
- An external service requires authorization
- A production action could create financial or operational risk

After every phase:

- Run type checking
- Run linting
- Run unit tests
- Run integration tests
- Test mobile and desktop layouts
- Inspect the actual rendered interface
- Fix regressions before continuing
- Summarize what changed
- State what remains mocked
- State what is genuinely functional
- State which actions are real versus simulated
- Confirm whether tenant isolation and permission checks still pass

Do not merely change labels to make the product sound intelligent.

Build the underlying operating behavior.

Do not stop at planning.

Implement the product.

---

# 25. AUTHORITATIVE UI REFERENCE

Use the attached mobile UI reference as the primary visual direction for Mise unless an existing production component is demonstrably stronger.

The reference should guide:

- Information density
- Mobile proportions
- Navigation placement
- Section rhythm
- Card sizing
- Typography scale
- Button hierarchy
- Status badges
- Icon treatment
- Spacing
- Visual restraint
- Use of warm white surfaces
- Use of Mise red as a controlled accent
- One-handed mobile operation
- Clear top-level hierarchy
- Compact but readable operating screens

Do not copy the reference mechanically.

Translate its strongest qualities into a more operational, intelligent product.

The visual target is:

- Native-feeling
- Calm
- Premium
- Fast
- Focused
- Warm
- Trustworthy
- Operational
- Highly legible
- Designed for daily use under pressure

The product must not feel like:

- A generic admin dashboard
- A no-code template
- A collection of disconnected cards
- A chatbot wrapped in navigation
- A restaurant-themed task manager
- A POS clone
- A prototype filled with placeholder metrics

## UI Reference Observations

The attached reference succeeds because it uses:

- A consistent five-tab mobile navigation
- Clear screen titles
- Compact status chips
- Strong visual hierarchy
- Minimal decorative elements
- Limited accent color
- Distinct primary actions
- Legible data groupings
- Calm white and off-white backgrounds
- Reusable list rows
- Familiar native-mobile interaction patterns
- Sufficient spacing without excessive emptiness
- Clear separation between sections
- Small, restrained illustrations used only where they add warmth

Preserve these strengths.

Improve the reference by making the product behavior more autonomous and specific to restaurant operations.

For example:

- “At a glance” should become “Today’s operating outlook.”
- “Daily briefing” should explain what Mise learned and completed.
- “Top tasks” should distinguish human tasks from Mise-generated operational actions.
- “Inventory health” should explain why the score changed.
- “Orders” should show decisions, deadlines, and supplier logic.
- “Ask Mise” should use real structured operational context rather than generic chat responses.
- “More” should expose restaurant memory, automation rules, activity history, permissions, and integrations.

## Mobile Layout Rules

Use the reference proportions as a baseline.

Target:

- Primary mobile viewport: 390×844 logical pixels
- Secondary testing widths: 320, 360, 375, 390, 414, and 430 pixels
- Desktop testing widths: 1024, 1280, 1440, and 1728 pixels

Mobile rules:

- Keep the most important operational state within the first viewport.
- Avoid requiring the owner to scroll past generic metrics before seeing urgent decisions.
- Place the most important action above secondary reporting.
- Use sticky bottom navigation.
- Respect safe-area insets.
- Use minimum 44×44 pixel interaction targets.
- Avoid more than two primary actions in one card.
- Avoid multi-column grids below 375 pixels unless content remains readable.
- Avoid text smaller than 12 pixels.
- Use 14–16 pixels for standard body text.
- Use 16–18 pixels for prominent list labels.
- Use 24–30 pixels for primary page-level status statements.
- Keep line lengths short.
- Prevent fixed bottom navigation from covering content.
- Use sheets, drawers, or dedicated screens for deep reasoning and evidence.
- Keep repetitive supporting metadata collapsed by default.
- Use inline status only when it materially improves scanning.

Desktop rules:

- Do not stretch mobile cards across the entire screen.
- Use a focused center column.
- Use a right-side rail for activity, monitoring, approvals, or contextual intelligence where useful.
- Keep maximum readable content width between approximately 1120 and 1280 pixels.
- Preserve the same information hierarchy as mobile.
- Do not create a separate visual language for desktop.
- Use desktop space to reveal more context, not more clutter.

## Design Tokens

Create one centralized design-token system.

Suggested semantic tokens:

- `background.app`
- `background.surface`
- `background.subtle`
- `background.critical`
- `background.warning`
- `background.success`
- `text.primary`
- `text.secondary`
- `text.muted`
- `text.inverse`
- `border.default`
- `border.strong`
- `brand.primary`
- `brand.primaryHover`
- `status.critical`
- `status.warning`
- `status.success`
- `status.info`
- `focus.ring`

Suggested visual direction:

- App background: warm white
- Surfaces: white or lightly warm gray
- Primary text: near-black, not pure black
- Secondary text: neutral gray
- Brand red: controlled and high-contrast
- Success green: only for verified positive states
- Warning amber: uncertainty or watch state
- Critical red: urgent, failed, or unsafe state

Use one spacing scale.

Example:

- 4
- 8
- 12
- 16
- 20
- 24
- 32
- 40
- 48
- 64

Use one radius scale.

Example:

- Small: 8
- Medium: 12
- Large: 16
- Pill: 999

Use one shadow strategy.

Most components should rely on borders and surface contrast rather than heavy shadows.

## Component System

Create reusable, documented components for:

- App shell
- Bottom navigation
- Page header
- Restaurant switcher
- Operating status
- Approval card
- Recommendation card
- Activity event
- Activity timeline
- Monitoring row
- Task row
- Inventory row
- Supplier row
- Order card
- Data freshness label
- Confidence indicator
- Status badge
- Empty state
- Error state
- Offline state
- Integration state
- Evidence drawer
- Explanation drawer
- Confirmation dialog
- Autonomy label
- Memory card
- Outcome card
- KPI with explanation
- Timeline section
- Section header
- Search field
- Filter chips
- Primary action bar

Do not implement one-off versions of these components per screen.

Every component must have:

- Default state
- Loading state
- Empty state
- Error state
- Disabled state
- Permission-denied state where relevant
- Mobile behavior
- Desktop behavior
- Accessibility labels
- Keyboard behavior
- Test coverage

---

# 26. OPERATIONAL BACKEND TARGET ARCHITECTURE

Mise must become an operational backend, not merely a polished frontend.

The backend is the product.

The interface is the control surface.

The system should continuously convert restaurant data into operational decisions and actions.

## Core Backend Responsibilities

The backend must:

- Ingest restaurant events
- Normalize source data
- Maintain restaurant-specific state
- Calculate forecasts
- Detect anomalies
- Generate issues
- Generate recommendations
- Prepare actions
- Enforce permissions
- Execute approved actions
- Track outcomes
- Produce activity history
- Learn restaurant-specific patterns
- Surface failures
- Preserve auditability

## Domain Boundaries

Organize the backend into clear bounded domains.

Recommended domains:

### Identity and Access

Responsibilities:

- Authentication
- User profiles
- Restaurant membership
- Location access
- Roles
- Permissions
- Session management
- Invitation flows

### Restaurant Configuration

Responsibilities:

- Restaurant details
- Locations
- Operating hours
- Service periods
- Units
- Locale
- Time zone
- Notification preferences
- Autonomy settings
- Approval rules
- Spend limits

### Integrations

Responsibilities:

- POS
- Reservations
- Scheduling
- Supplier systems
- Email
- Accounting
- Weather
- Local events
- Review sources

Each integration must expose:

- Connection status
- Last successful sync
- Last attempted sync
- Data coverage
- Error state
- Retry state
- Authorization state
- Source-specific cursor or checkpoint
- Idempotency behavior

### Sales and Demand

Responsibilities:

- Transaction ingestion
- Menu-item sales history
- Demand forecasts
- Service-period forecasts
- Trend detection
- Forecast error measurement
- Demand anomalies

### Recipes and Ingredient Mapping

Responsibilities:

- Menu items
- Recipes
- Ingredient quantities
- Yield
- Portion assumptions
- Substitutions
- Recipe versions
- Menu availability effects

### Inventory

Responsibilities:

- Inventory items
- Counts
- Estimated on-hand quantities
- Consumption
- Depletion forecasts
- Safety stock
- Reorder points
- Count freshness
- Variance
- Waste
- Stockout risk

### Purchasing

Responsibilities:

- Suppliers
- Catalogs
- Price history
- Supplier reliability
- Purchase recommendations
- Draft orders
- Approval
- Sending
- Confirmation
- Receiving
- Invoice reconciliation
- Discrepancies

### Tasks and Operations

Responsibilities:

- Tasks
- Checklists
- Assignees
- Deadlines
- Service windows
- Dependencies
- Verification
- Recurrence
- Escalation
- Completion evidence

### Team and Labor

Responsibilities:

- Employees
- Roles
- Shift schedules
- Coverage
- Availability
- Staffing pressure
- Labor forecasts
- Communication permissions

### Recommendations and Actions

Responsibilities:

- Operational issues
- Recommendations
- Proposed actions
- Approval states
- Execution states
- Failure handling
- Rollback
- Outcome tracking

### Activity and Audit

Responsibilities:

- Operational timeline
- User activity
- Automated activity
- Integration activity
- Failures
- Approvals
- Outcome measurement
- Immutable audit records

### Restaurant Memory

Responsibilities:

- Learned patterns
- Preferences
- Exceptions
- Confidence
- Evidence
- Corrections
- Rule conversion
- Forgetting and disabling

## Event-Driven Architecture

Use event-driven processing where it materially improves reliability and traceability.

Example events:

- `pos.sale_recorded`
- `pos.sync_completed`
- `inventory.count_recorded`
- `inventory.quantity_estimated`
- `inventory.stockout_risk_detected`
- `forecast.updated`
- `recommendation.created`
- `recommendation.approved`
- `recommendation.rejected`
- `order.draft_created`
- `order.sent`
- `supplier.confirmation_received`
- `delivery.logged`
- `invoice.discrepancy_detected`
- `task.created`
- `task.completed`
- `schedule.updated`
- `memory.created`
- `memory.corrected`
- `action.failed`
- `outcome.measured`

Every event should contain:

- Event ID
- Tenant ID
- Restaurant ID
- Location ID where applicable
- Event type
- Occurred-at timestamp
- Recorded-at timestamp
- Source
- Actor
- Correlation ID
- Causation ID
- Idempotency key
- Schema version
- Structured payload

Use correlation IDs to connect:

Signal → issue → recommendation → action → result → outcome → memory.

## Background Jobs

Use a reliable job queue for:

- Integration syncs
- Forecast recalculation
- Inventory depletion updates
- Recommendation generation
- Order preparation
- Supplier confirmation polling
- Delivery reconciliation
- Outcome measurement
- Daily brief generation
- Notification delivery
- Activity aggregation
- Memory extraction
- Retry processing

Every job must support:

- Idempotency
- Retry limits
- Exponential backoff
- Dead-letter handling
- Timeout
- Cancellation where applicable
- Structured logging
- Tenant scoping
- Metrics
- Failure visibility

Never hide background-job failures.

Surface user-relevant failures in the application.

## Source of Truth

Define explicit ownership for every field.

Examples:

- POS is source of truth for completed sales.
- Manual count or verified scan is source of truth for confirmed inventory.
- Forecast engine is source of truth for estimated consumption.
- Supplier confirmation is source of truth for acknowledged delivery commitment.
- User completion plus required evidence is source of truth for verified tasks.
- Mise must label estimates as estimates.

Do not allow natural-language AI output to overwrite structured source-of-truth data directly.

## API Design

Use typed, versioned APIs.

Prefer explicit domain endpoints or service procedures.

Examples:

- `GET /restaurants/:id/operating-brief`
- `GET /restaurants/:id/activity`
- `GET /restaurants/:id/approvals`
- `GET /restaurants/:id/inventory-risks`
- `POST /recommendations/:id/approve`
- `POST /recommendations/:id/reject`
- `POST /orders/:id/send`
- `POST /deliveries`
- `POST /inventory/counts`
- `GET /restaurant-memory`
- `PATCH /restaurant-memory/:id`
- `GET /integrations/status`

Every write endpoint must enforce:

- Authentication
- Tenant membership
- Role permission
- Action permission
- Input validation
- Idempotency
- Audit event creation
- Rate limiting where appropriate
- Clear errors

## Database Requirements

Use strict tenant isolation.

Every tenant-owned row must include:

- `restaurant_id`
- `location_id` where applicable

Use:

- Foreign keys
- Unique constraints
- Check constraints
- Transactional writes
- Indexed tenant-scoped queries
- Soft deletion only where operational history requires it
- Immutable audit records
- Migration tests
- Rollback plans

For Supabase or PostgreSQL:

- Enforce Row Level Security
- Test all policies
- Prevent cross-tenant joins
- Avoid service-role use in client environments
- Keep secrets server-side
- Validate membership in database policies and server logic
- Do not rely solely on frontend filtering

## Observability

Implement:

- Structured logs
- Error monitoring
- Job metrics
- Integration health
- Forecast accuracy
- Recommendation conversion
- Approval latency
- Action success rate
- Duplicate-action prevention metrics
- Data freshness
- Sync duration
- Activity-event throughput
- Tenant-level diagnostics without exposing sensitive data

Create an internal operational health view for developers and support.

Do not expose raw infrastructure details to restaurant users.

---

# 27. CODEX AND CURSOR OPERATING INSTRUCTIONS

This document is an execution specification.

Codex and Cursor must operate as implementation agents, not passive advisors.

## Required Agent Behavior

The agent must:

- Inspect before changing
- Preserve working behavior
- Prefer incremental refactors
- Verify assumptions against the repository
- Use existing conventions unless they are harmful
- Avoid broad rewrites without evidence
- Keep changes small enough to review
- Run tests continuously
- Inspect rendered output
- Report what is real versus mocked
- Never claim completion without verification

## Repository Audit

Before editing:

1. Print repository structure at a useful depth.
2. Identify package manager.
3. Identify application framework.
4. Identify mobile or web rendering model.
5. Identify database layer.
6. Identify authentication.
7. Identify API structure.
8. Identify state-management approach.
9. Identify design system.
10. Identify test frameworks.
11. Identify lint and type-check commands.
12. Identify deployment configuration.
13. Identify environment-variable requirements.
14. Identify current integrations.
15. Identify hardcoded data.
16. Identify demo-only behavior.
17. Identify security-sensitive files.
18. Identify current tenant model.
19. Identify RLS policies if Supabase is used.
20. Identify broken routes and dead components.

Create a concise audit artifact in the repository, such as:

- `docs/current-state-audit.md`
- `docs/mise-implementation-plan.md`
- `docs/domain-model.md`
- `docs/security-boundaries.md`

## Planning Rules

Create a phased plan before major changes.

Each phase must contain:

- Objective
- User-visible outcome
- Backend changes
- Frontend changes
- Data migrations
- Security implications
- Tests
- Risks
- Rollback strategy
- Definition of done

Do not create a vague backlog.

Each task must name likely files or modules.

## Editing Rules

When editing:

- Reuse components.
- Remove duplication.
- Keep domain logic out of view components.
- Keep calculations out of LLM prompts.
- Keep external-action code server-side.
- Add schemas for all external data.
- Add explicit types for domain objects.
- Add migrations with backward compatibility where possible.
- Add tests with every behavior change.
- Do not mix unrelated refactors into one change.
- Do not silently rename persisted fields.
- Do not delete data without migration and rollback plans.
- Do not bypass permissions for convenience.
- Do not place secrets in code.
- Do not use mock results in production paths.

## UI Implementation Rules

When translating the attached reference:

- Match its calm density.
- Match its mobile rhythm.
- Use similar proportions.
- Preserve Mise branding.
- Improve operational specificity.
- Do not trace the reference pixel-for-pixel.
- Do not introduce excessive visual novelty.
- Do not create generic dashboard charts.
- Use real data or clearly labeled demo data.
- Keep critical actions prominent.
- Keep deep reasoning expandable.
- Use native interaction patterns.
- Validate at all target viewport widths.

## Backend Implementation Rules

For every new autonomous behavior, the agent must implement:

1. Trigger
2. Structured input
3. Deterministic calculation or policy
4. Recommendation or action record
5. Permission check
6. Execution path
7. Audit event
8. User-visible status
9. Failure handling
10. Outcome measurement
11. Test coverage

A feature is not complete if it only changes UI text.

## Agent Checkpoints

After each meaningful batch:

- Run formatter
- Run lint
- Run type checking
- Run unit tests
- Run integration tests
- Run end-to-end tests where available
- Build production bundle
- Inspect console errors
- Inspect network errors
- Inspect mobile layout
- Inspect desktop layout
- Confirm no tenant leak
- Confirm no duplicate side effect
- Confirm activity records are accurate
- Confirm demo and production paths remain separate

## Completion Report Format

At the end of each phase, report:

### Implemented

List real changes.

### Verified

List tests and manual checks completed.

### Still Mocked

List all simulated or hardcoded behavior.

### Risks

List unresolved concerns.

### Next Phase

List exact next implementation steps.

Do not say “fully complete” unless:

- All tests pass
- Production build succeeds
- Rendered UI was inspected
- Core workflows function end to end
- Security checks pass
- No known critical mocks remain

---

# 28. CURSOR-SPECIFIC WORKFLOW

When using Cursor:

- Create an implementation plan in-repo.
- Use repository search before editing.
- Reference exact files.
- Work in small diffs.
- Use project rules to preserve this specification.
- Add this document to `.cursor/rules` or equivalent project instructions if supported.
- Keep the rules concise in the always-on file and link to this master document.
- Use separate branches or checkpoints for major phases.
- Review generated changes before applying broad edits.
- Avoid “fix all” actions across unrelated files.
- Use terminal commands to validate every phase.
- Keep a running implementation log.

Suggested Cursor project rule:

> Mise is an autonomous restaurant operations backend with a calm mobile control surface. Do not build generic dashboards or fake AI behavior. Every recommendation must be grounded in structured evidence, every action must be permissioned and auditable, and every meaningful system event must create a truthful activity record. Preserve tenant isolation, source-of-truth boundaries, and the attached UI direction.

---

# 29. CODEX-SPECIFIC WORKFLOW

When using Codex:

- Begin with repository inspection.
- State assumptions.
- Ask only when credentials, destructive changes, or unknowable architecture decisions block progress.
- Use the terminal to run the application and tests.
- Inspect generated pages where tooling permits.
- Prefer complete vertical slices over disconnected files.
- Keep external actions disabled or sandboxed until explicitly configured.
- Mark demo behavior clearly.
- Do not fabricate integration success.
- Do not stop after a plan.
- Implement the next safe phase.
- Continue until blocked by a genuine external dependency.

Codex should prioritize vertical slices in this order:

1. Truthful activity system
2. Operating brief
3. Inventory risk detection
4. Recommendation creation
5. Approval flow
6. Order preparation
7. Delivery logging
8. Inventory update
9. Outcome measurement
10. Restaurant memory

---

# 30. PRIORITIZED PRODUCT ROADMAP

## Milestone 1 — Trustworthy Operator Foundation

Build:

- Tenant-safe data model
- Activity events
- Data freshness
- Explicit action statuses
- Recommendation model
- Approval model
- Error and integration states
- Demo/production separation

Success means:

Mise never pretends work happened.

## Milestone 2 — Operating Brief

Build:

- Restaurant status
- Since You Were Away
- Live Operations Activity
- Needs Your Approval
- Today’s Outlook
- Mise Is Watching

Success means:

An owner understands the restaurant in under 10 seconds.

## Milestone 3 — Inventory-to-Order Automation

Build:

- POS demand mapping
- Ingredient consumption
- Depletion prediction
- Stockout time
- Supplier comparison
- Draft order
- Approval
- Send
- Confirmation
- Delivery log
- Reconciliation
- Inventory update

Success means:

One operational workflow works end to end.

## Milestone 4 — Daily Operating Plan

Build:

- Timeline
- Task generation
- Service windows
- Dependencies
- Staff assignment
- Verification
- Reprioritization

Success means:

The Today screen runs the day rather than listing tasks.

## Milestone 5 — Restaurant Memory

Build:

- Learned patterns
- Evidence
- Confidence
- Corrections
- Rules
- Outcome feedback

Success means:

Recommendations become restaurant-specific.

## Milestone 6 — Broader Operations

Add:

- Labor coverage
- Waste analysis
- Menu engineering
- Supplier reliability
- Review monitoring
- Reservations
- Weather
- Local events
- Equipment maintenance

Do not begin this milestone before the core inventory-to-order workflow is reliable.

---

# 31. FINAL IMPLEMENTATION DIRECTIVE

Treat the attached UI reference as the visual quality bar.

Treat this document as the product and engineering source of truth.

Build Mise into an operational backend that acts like a full-time restaurant operator.

Do not merely improve the appearance.

Do not merely add AI language.

Do not merely add dashboards.

Create real operational loops.

Every loop must:

- Observe
- Understand
- Predict
- Recommend
- Prepare
- Request approval where needed
- Execute safely
- Verify
- Record activity
- Measure outcome
- Learn

The application should make the owner feel:

> “My restaurant is being operated even when I am not there.”

The owner supervises.

Mise operates.
