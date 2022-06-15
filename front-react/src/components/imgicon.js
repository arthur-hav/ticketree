import React from "react";

export class ImgIcon extends React.Component {
    render() {
        if (!this.props.img_id) return;
        const img_src = `${process.env.REACT_APP_API_SERVER}/img/${this.props.img_id}`
        return <img src={img_src} alt={this.props.img_id}></img>
    }
}