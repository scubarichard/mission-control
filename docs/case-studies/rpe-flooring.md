# Case Study: Atlanta Flooring Solutions (RPE Systems)
## How We Cut Quote Turnaround Time by 50% and Built a $199/mo Recurring Revenue Stream

**Client:** RPE Systems / Atlanta Flooring Solutions  
**Industry:** Home Services / Commercial Flooring  
**Stack:** Pipedrive → n8n → ClickUp  
**Timeline:** 6 weeks (initial build) + ongoing optimization  
**Investment:** $12,500 initial + $199/mo maintenance  

---

## The Challenge

Atlanta Flooring Solutions had a classic operations disconnect. Sales reps were crushing it in Pipedrive — booking site visits, generating quotes, closing deals. But the moment a deal moved to "won," chaos began:

- **Manual handoff hell:** Sales had to email project details to operations, who'd then manually create projects in ClickUp
- **Quote delays:** Creating quotes took 2-3 days because sales had to wait for operations to pull material costs
- **Lost context:** Customer preferences, special requests, and site notes got lost between systems
- **No visibility:** Sales couldn't see project status; operations couldn't see pipeline health
- **Scale problems:** Adding more sales reps just created more bottlenecks

**The real cost:** They were losing 2-3 deals per week due to slow quotes. At $8,000 average project value, that's $64,000–$96,000 in lost revenue monthly.

---

## The Solution

We built a fully automated bridge between sales and operations using n8n as the orchestration engine:

### 1. **Instant Project Creation**
- When a deal hits "Won" in Pipedrive → n8n creates a ClickUp project automatically
- All deal fields map to project fields: contact info, square footage, material preference, timeline
- Custom fields sync: budget range, flooring type, commercial vs. residential

### 2. **Automated Quote Generation**
- Site visit scheduled in Pipedrive → triggers quote template in ClickUp
- Pulls real-time material costs from supplier API
- Generates PDF quote with company branding
- Sends to customer via email with e-signature link
- **Result:** Quotes now go out same-day, not 2-3 days later

### 3. **Bi-Directional Status Sync**
- ClickUp project status updates → reflected in Pipedrive deal stages
- Sales sees "Materials Ordered," "Installation Scheduled," "Complete" without asking operations
- Operations sees new deals coming down the pipeline for resource planning

### 4. **Smart Notifications**
- High-value deals ($25K+) trigger Slack alerts to operations manager
- Quote approval requests go directly to decision makers
- Installation complete → triggers review request email to customer

---

## The Technical Architecture

```
PIPEDRIVE                    n8n WORKFLOWS                    CLICKUP
━━━━━━━━━━                  ━━━━━━━━━━━━━━                  ━━━━━━━━
Deal Won       ──webhook──> Create Project    ──────API────> New Project
                             Map All Fields                   + Subtasks
                             Add Team Members                 + Due Dates

Site Visit     ──webhook──> Generate Quote    ──────API────> Quote Task
Scheduled                    Pull Pricing                     + PDF Gen
                            Send to Customer                  + Approval

Deal Updated   ──webhook──> Sync Status       ──────API────> Update Status
                            Check Conditions                  + Comments
                            Route Alerts                      + Attachments
```

**Error Handling:** Every workflow has retry logic, error notifications, and fallback paths. If the supplier API is down, it uses cached pricing. If ClickUp is slow, it queues and retries.

---

## The Results

### Immediate Wins (First 30 Days)
- **Quote turnaround:** 2-3 days → 4 hours average
- **Manual data entry:** 10 hours/week → 0
- **Deal velocity:** 18% faster close rate due to quick quotes
- **Team morale:** Operations stopped complaining about surprise projects

### 90-Day Impact
- **Revenue increase:** $180,000 in deals they would have lost to slow quotes
- **Operational efficiency:** Handled 40% more projects with same team
- **Customer satisfaction:** NPS score up 22 points (faster response = happier customers)
- **Scale achieved:** Added 2 sales reps without adding operations headcount

### The M6 Productization

After seeing the results, RPE wanted ongoing optimization. We created "M6" — their $199/mo maintenance package:

**What's Included:**
- Monthly workflow optimization based on new bottlenecks
- Proactive monitoring (we see issues before they do)
- New automation requests (up to 2 hours/month)
- Priority support via Slack
- Quarterly business review with recommendations

**Why It Works:** Every month, their business changes slightly. New suppliers, new deal types, new team members. The $199/mo ensures their automation evolves with them instead of breaking.

---

## Client Testimonial

> "Before 1AltX, our sales and ops teams might as well have been different companies. Now everything flows. A deal closes in Pipedrive, and 30 seconds later there's a project in ClickUp with tasks assigned. Our sales team can see project status without bothering ops. Quotes that took days now take hours. We've literally paid for the entire project cost in the first month just from deals we didn't lose to slow quotes."
>
> **— Carey Hunter, Operations Director, Atlanta Flooring Solutions**

---

## Key Takeaways

1. **The real ROI isn't time saved — it's deals not lost.** Saving 10 hours/week is nice. Not losing $96K/month in deals is transformative.

2. **Start with the biggest bottleneck.** Quote generation was killing them. We fixed that first, proved value, then expanded.

3. **Bi-directional sync changes everything.** When sales can see ops and ops can see sales, the entire business accelerates.

4. **Maintenance matters.** One-time builds break. The $199/mo M6 package keeps everything running and improving.

5. **Documentation is insurance.** Every workflow is documented. If we get hit by a bus, they can still operate.

---

## The Stack That Made It Possible

- **Pipedrive:** Native webhooks fire instantly on deal changes
- **n8n:** Self-hosted on their infrastructure for security and speed
- **ClickUp:** Flexible enough to mirror their exact project structure
- **Make.com:** Backup orchestration for critical paths
- **Cloudflare Workers:** API caching layer for supplier pricing

---

## Could This Work for Your Business?

If you're experiencing any of these symptoms:
- Sales and operations use different systems
- Quotes take more than 24 hours
- You lose deals to slow response time
- Team members spend hours copying data between tools
- You can't scale without adding headcount

Then yes — this exact approach would transform your operations.

**Next Step:** [Book a 15-minute call](https://calendly.com/1altx/30min) to discuss your specific bottlenecks.

---

## Project Metrics

**Build Time:** 6 weeks from kickoff to full deployment  
**Initial Investment:** $12,500  
**Monthly Maintenance:** $199/mo (M6 package)  
**Payback Period:** 3 weeks (based on recovered deals)  
**Current Status:** Active client since May 2025, 10 months running  

---

*Want to see the actual workflows in action? We can show you a demo of the RPE system (with their permission) during our discovery call.*

---

© 2026 1AltX LLC | [1altx.com](https://1altx.com) | richard@1altx.com