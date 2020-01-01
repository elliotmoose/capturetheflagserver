const NewFlag = function(team, position) {
    return {
        id: `flag_${team}`,
        position: position,
        radius: 24,
        carrier_id: null,
        team: team
    }
}

module.exports = { NewFlag };