def flatten(tickets_json):
    template_vars = {}
    for ticket in tickets_json['tickets']:
        ticket['status'] = ticket['status'].lower().capitalize()
        for tcks in template_vars.values():
            added = False
            for i, son in enumerate(tcks):
                if son['ticket_id'] == ticket['parent_id']:
                    ticket['depth'] = son['depth'] + 1
                    tcks.insert(i + 1, ticket)
                    added = True
                    break
            if added:
                break
        else:
            ticket['depth'] = 0
            template_vars[ticket['ticket_id']] = [ticket]
    return template_vars
