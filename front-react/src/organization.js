import TextareaAutosize from 'react-textarea-autosize';
import React from "react";
import { useState } from "react";
import { ImgIcon } from "./components/imgicon.js";
import { useQuery } from 'react-query'
import Select from 'react-select'

const new_organization = {
    display_name: 'New organization',
    parent: null
}

const customStyles = {
  menu: (provided, state) => ({
    ...provided,
    backgroundColor: "#1f441f",
  }),
  control: (provided, state) => ({
    ...provided,
    backgroundColor: "#447744",
  })
}

function create_son(parent_org, all_tck, set_all_tck, my_profile){
    var son_org = { ...new_organization}
    son_org.parent = parent_org.organization_id;
    create_organization(son_org, all_tck, set_all_tck, my_profile);
}

class Users extends React.Component{
    upValue(props) {
        var current_user_org = [];
        if (props.user_org_data && props.user_data.data.users){
            for (var user_org_idx in props.user_org_data.user_organization) {
                var user_org = props.user_org_data.user_organization[user_org_idx]
                if (user_org.organization_id === props.organization.organization_id){
                    var label = "Undefined"
                    for (var user_idx in props.user_data.data.users) {
                        if (user_org.user_id === props.user_data.data.users[user_idx].user_id){
                            label = props.user_data.data.users[user_idx].username
                        }
                    }
                    current_user_org.push({value: props.user_org_data.user_organization[user_org_idx].user_id,
                    label: label})
                }
            }
        }
        return current_user_org
    }

    constructor(props) {
        super(props);
        var options = [];
        if (props.user_data.data.users){
            options = props.user_data.data.users.map((user) => { return {label: user.username, value: user.user_id}})
        }
        this.state = {value: this.upValue(props), options: options}
    }
    shouldComponentUpdate(nextProps) {
        if(nextProps.organization !== this.props.organization
           || nextProps.user_data.data.users !== this.props.user_data.data.users
           || nextProps.user_org_data !== this.props.user_org_data) {
            this.setState({value: this.upValue(nextProps)})
        }
        if(nextProps.options !== this.props.options) {
            this.setState({options: nextProps.options})
        }
        return true;
    }
    updateValue = (value) => {
        this.setState({value: value});
    }
    render() {
        return <Select isMulti="true" options={this.state.options} styles={customStyles} value={this.state.value}
            onChange={this.updateValue}
            onBlur={() => set_user(this.state.value, this.props.organization, this.props.user_org_data, this.props.set_user_org_data)}/>
    }
}

function create_organization_element(all_tck, set_all_tck, my_profile){
    return (
       <button className="ticket-row add-ticket" onClick={() => create_organization(new_organization, all_tck, set_all_tck)}>
         <h4>Add a new organization</h4>
       </button>
    );
}

function specific_search_organization(elem){
return "";
}

function organization_from_json(all_tck, search, set_selected){
    const fltr_organizations = all_tck.organizations.filter(organization => typeof(search) === "undefined"
                                            || organization.display_name.toLowerCase().includes(search.string.toLowerCase()))
    const organizations = fltr_organizations.map((organization) => {
    return (
      <div className="ticket-row ticket-paper" key={organization.organization_id} onClick={() => set_selected(organization)}>
        <div className="icons">
          <ImgIcon img_id={organization.organization_id} />
        </div>
        <div className="title" >
           <h5>{organization.display_name}</h5>
        </div>
      </div>
    );
   });
   return organizations;
}

function create_organization(organization, all_tck, set_all_tck){
    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const url = `${process.env.REACT_APP_API_SERVER}/api/organization`
    const request = new Request(url, {method: 'POST', body: JSON.stringify(organization), headers:myHeaders});
    fetch (request).then(response => response.json()).then(data => {
        var obj = { ...organization}
        obj.organization_id = data.organization_id;
        set_all_tck({organizations: all_tck.organizations.concat([obj])});
    });

}

function set_display_name(organization, set_ticket, event, all_tck, set_all_tck){
    organization.display_name = event.target.value;
    put_organization(organization, set_ticket, all_tck, set_all_tck);
}

function set_user(value, organization, user_org_data, set_user_org_data){
    var new_user_data = {user_organization: value.map((option) => {
        return {user_id: option.value, organization_id: organization.organization_id}})}
    for (var idx in user_org_data.user_organization) {
        if (user_org_data.user_organization[idx].organization_id !== organization.organization_id){
            new_user_data.user_organization.push(user_org_data.user_organization[idx])
        }
    }
    set_user_org_data(new_user_data);
    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const url = `${process.env.REACT_APP_API_SERVER}/api/organization_user/${organization.organization_id}`
    const request = new Request(url, {method: 'PUT', body: JSON.stringify(
           {lst: value.map((val) => val.value)}), headers: myHeaders});
    fetch(request);
}

function put_organization(organization, set_ticket, all_tck, set_all_tck){
    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const url = `${process.env.REACT_APP_API_SERVER}/api/organization/${organization.organization_id}`
    const request = new Request(url, {method: 'PUT', body: JSON.stringify(organization), headers: myHeaders});
    fetch(request);
    const new_tck = {organizations: all_tck.organizations.map((org) => org.organization_id !== organization.organization_id ?
            org : { ...organization})}
    set_all_tck(new_tck)
    set_ticket({ ...organization})
}

class DisplayNameArea extends React.Component {
    constructor(props) {
        super(props);
        this.state = {display_name: props.organization.display_name}
    }
    shouldComponentUpdate(nextProps) {
        if(nextProps.organization.display_name !== this.props.organization.display_name){
            this.setState({display_name: nextProps.organization.display_name})
        }
        return true;
    }
    updateText = (event) => {
        event.preventDefault();
        this.setState({display_name: event.target.value});
    }
    render() {
        return (
            <TextareaAutosize className="pane-title edit-text"
                value={this.state.display_name}
                onChange={this.updateText}
                onBlur={(event) => set_display_name(this.props.organization, this.props.set_ticket, event, this.props.all_tck, this.props.set_all_tck)}>
            </TextareaAutosize>
        );
    }
}


const PaneLeft: React.FC<Props> = ({
  ticket,
  set_ticket,
  all_tck,
  set_all_tck,
  my_profile
}) => {
    const user_data = useQuery('profilesData', () =>
          fetch(`${process.env.REACT_APP_API_SERVER}/api/profiles`).then(res => res.json()))

    const query_user_org_data = useQuery('userOrgData', () =>
          fetch(`${process.env.REACT_APP_API_SERVER}/api/user_organization`).then(res => res.json()))

    const [user_org_data, set_user_org_data] = useState();
    if (!ticket){
        return (
          <div className="pane-left">
            <h4>Select a user to see its details</h4>
          </div>
        );
      }
    if (query_user_org_data.data && !user_org_data){
        set_user_org_data(query_user_org_data.data)
    }
      var sons = []
      for (var tck_idx in all_tck.organizations){
        if(ticket.organization_id && all_tck.organizations[tck_idx].parent === ticket.organization_id){
            const son_org = all_tck.organizations[tck_idx]
            sons.push(
                <div className="ticket-row-mini ticket-paper"
                    key={son_org.organization_id}
                    onClick={() => set_ticket(son_org)}>
                    <div className="flex1 title-mini">{son_org.display_name}</div>
                </div>
            )
        }
      }
      return (
      <div className="pane-left">
        <div>
          <ImgIcon img_id={ticket.organization_id} />
        </div>
        <DisplayNameArea organization={ticket} set_ticket={set_ticket} all_tck={all_tck} set_all_tck={set_all_tck}/>
        <Users user_data={user_data} user_org_data={user_org_data} set_user_org_data={set_user_org_data}
          organization={ticket} />
          <button className="add-ticket ticket-row-mini" onClick={() => create_son(ticket, all_tck, set_all_tck, my_profile)}>
            <span>Create son</span>
          </button>
          {sons}
      </div>
      );
}

export const export_org = {
    create: create_organization_element,
    from_json: organization_from_json,
    pane_left: PaneLeft,
    search: specific_search_organization,
}