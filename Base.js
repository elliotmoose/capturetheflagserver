const NewBase = function(team, position) {
    return {
        id: `base_${team}`,
        position: position,
        radius: 60,        
        team: team
    }
}

module.exports = { NewBase };