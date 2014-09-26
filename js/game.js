function Game()
{
  this.player = new Player();
  this.difficultyColors = ['#555', '#00DD00', '#E6DE00', '#FF8E46'];
  setInterval(this.updateUI, 2000);
}

Game.prototype.updateUI = function() {
  var g = window.game;

  g.drawLevel();
  g.drawInventory();
  g.drawRecipes();
}

Game.prototype.step = function() {
  var drops = this.gather();
  this.player.collect(drops);
  this.updateUI();
}

Game.prototype.gather = function() {
  var drops = [];
  for (var prop in Resources)
  {
    if(Resources.hasOwnProperty(prop)) {
      var item = Resources[prop];
      var pick = this.player.equipment.items[Slot.Pick];
      var lootModifier = (item == Resources.Wood ? 1 : 0);
      if (pick) {
        lootModifier = (typeof pick.LootModifiers[item.name] == "undefined" ? lootModifier : pick.LootModifiers[item.name]);
      }

      if (lootModifier == 0) {
        continue;
      }

      // Stop processing items if the player's level is too low
      if (item.minLevel > this.player.level) {
        break;
      }

      if (item.dropChance > this.r()) {
        drops.push({ item: item, amount: Math.ceil(this.r() * item.maxDropAmount * lootModifier)})
      }
    }
  }

  return drops;
}

Game.prototype.craft = function(amount, itemLevel) {
  amount = parseInt(amount);
  var $current = $('#recipeList li.selectedRecipe');
  if ($current.length > 0) {
    var recipe = $current.data();
    this.craftRecipe(recipe, amount, $current);
  }
}

Game.prototype.craftAll = function() {
  var $current = $('#recipeList li.selectedRecipe');
  if ($current.length > 0) {
    var recipe = $current.data();
    var amount = this.player.getCraftableAmount(recipe);
    this.craftRecipe(recipe, amount, $current);
  }
}

Game.prototype.craftRecipe = function(recipe, amount, el) {
  if (amount == 0) {
    return;
  }

  var g = window.game;
  var p = g.player;

  // Confirm the necessary requirements are still met for this recipe
  if (p.getCraftableAmount(recipe) == 0) {
    // Stop the animation
    el.stop();
    
    // Return the width of the recipe to full-width
    el.width(g.recipeWidth);
    return;
  }

  // Note that crafting of the given recipe has been requested.
  p.crafting[recipe.name] = el;

  // Show the cancel icon
  var id = recipe.name.replace(/ /g, '');
  var $cancelLink = $('#rc_' + id)
  $cancelLink.show();

  var multiplier = 0;
  if (recipe.forge) {
    for (var prop in p.inventory.forges) {
      if(p.inventory.forges.hasOwnProperty(prop)) {
        var smeltModifier = 1;
        var forge = p.inventory.forges[prop];
        smeltModifier = (forge.SmeltModifiers && typeof forge.SmeltModifiers[recipe.name] != "undefined" ? forge.SmeltModifiers[recipe.name] : smeltModifier);
        multiplier += smeltModifier;
      }
    }
  }

  multiplier = multiplier || 1;
  var craftTime = Math.round(recipe.craftTime * 1000 / multiplier);

  var craftTime = this.cheat ? 0 : craftTime;

  // Begin the crafting animation.
  var count = amount;
  el.addClass('animating').width(0).animate(
    { width: g.recipeWidth },
    craftTime,
    "linear",
    function() {
      // Clicking the cancel icon removes the queued up crafting request
      if (!p.crafting[recipe.name]) {
        amount = 0;
      }
      else {
        // Confirm the necessary requirements are still met for this recipe.
        // Since gathered materials could have changed during the crafting of this item,
        // recalculated the total amount that can still be crafted.
        amount = p.getCraftableAmount(recipe);
      }

      if (amount == 0) {
        // Stop the animation
        el.stop();

        // Return the width of the recipe to full-width
        el.width(g.recipeWidth);

        // Hide the cancel icon
        $cancelLink.hide();
      }
      else {
        p.craft(recipe);
        g.updateUI();
        g.craftRecipe(recipe, --count, el);

/* TODO:
          Can only use 4 forges at a time.
          Crafting a forge requires 4 of the previous level + some other mats.
          When no forges are in use and no smelting is being performed, all 4 forges will be available (checkbox checked) for smelting.
          Unchecking an available forge means it will not be used when a smelting request is made. This will allow for smelting multiple types of ore at once.
          Whenever a forge is in use, it is no longer available to take new smelting requests (checkbox disabled).

        if (recipe.Item.slot == Slot.Forge) {
          if (p.inventory.forges[recipe.itemLevel] == 1) {
            $('<th/>',
            {
              id: 'fn_' + recipe.itemLevel,
              text: recipe.name.replace(' Forge', '')
            })
            .appendTo('#forgeNames');
            $('<td/>',
            {
              id: 'f_' + recipe.itemLevel
            }).append(
              $('<img/>',
              {
                id: 'fi_' + recipe.itemLevel,
                src: 'images/forge.png'
              })
            )
            .appendTo('#forgeList');
            $('#forges').show();
          }
        }
*/
      }


      if (count == 0) {
        $(this).removeClass('animating');
        delete p.crafting[recipe.name];

        // Hide the cancel icon
        $cancelLink.hide();

        // During the crafting, the selected recipe could have changed.
        // If so, remove the background bar at the end of the animation.
        if (!el.hasClass('selectedRecipe')) {
          unselectRecipe(el);
        }
      }

      // Iterate through all other recipes queued up for crafting to confirm the necessary requirements are still met.
      // If not, cancel the crafting.
      for (var prop in p.crafting) {
        if(p.crafting.hasOwnProperty(prop)) {
          var $queuedRecipe = p.crafting[prop];
          var $queuedCancelLink = $queuedRecipe.find('.cancel');
          var amount = p.getCraftableAmount($queuedRecipe.data());
          if (amount == 0) {
            // Stop the animation
            $queuedRecipe.stop();

            // Return the width of the recipe to full-width
            $queuedRecipe.width(g.recipeWidth);

            // Hide the cancel icon
            $queuedCancelLink.hide();

            // Remove the background animation bar (unless recipe is selected)
            if (!$queuedRecipe.hasClass('selectedRecipe')) {
              unselectRecipe($queuedRecipe);
            }

            delete p.crafting[prop];
            $queuedRecipe.removeClass('animating');
          }
        }
      }
    });
}

Game.prototype.drawLevel = function() {
  var g = window.game;
  var p = g.player;

  var maxWidth = $('#recipeLevelBarText').width();
  $('#recipeLevelBar').width(Math.round(maxWidth * p.level / p.maxLevel));
  $('#recipeLevelBarText').text(p.level + '/' + p.maxLevel);
}

Game.prototype.drawRecipes = function() {
  var g = window.game;
  var p = g.player;

  for (var prop in Recipes) {
    if(Recipes.hasOwnProperty(prop)) {
      var recipe = Recipes[prop];
      if (this.player.level >= recipe.minLevel) {
        var hasScrollBar = $('#recipeScroll').hasScrollBar();
        var amount = p.getCraftableAmount(recipe);
        var id = prop.replace(/ /g, '');
        var $row = $('#r_' + id);
        if ($row.length) {
          var color = g.determineRecipeColor(recipe);

          $('#ra_' + id).text(amount > 0 ? '[' + amount + ']' : '')
          $('#rn_' + id).width(hasScrollBar ? 240 : 260) // fucking scrollbar
          if ($row.hasClass('selectedRecipe') || $row.hasClass('animating')) {
            $row.css('background-color', color);
            $row.css('color', 'white');

            var disabled = (amount == 0);
            $('#craft').prop('disabled', disabled);
            $('#craftAll').prop('disabled', disabled);
          }
          else
          {
            $row.css('color', color);
          }
        }
        else {
          $('#recipeList').prepend(
            $('<li/>',
            {
              id: 'r_' + id,
              data: recipe,
            })
            .append(
              $('<div/>',
              {
                id: 'rn_' + id,
                text: recipe.name,
                class: 'recipeName',
              }).width(hasScrollBar ? 240 : 260) // fucking scrollbar
              .append(
                $('<span/>',
                {
                  id: 'ra_' + id,
                  text: amount > 0 ? '[' + amount + ']' : ''
                })
              )
              .append(
                $('<a/>',
                {
                  id: 'rc_' + id,
                  class: 'floatRight cancel',
                  text: 'x',
                  title: 'Cancel',
                  href: '#',
                  click: function(event) {
                    var $el = $(this).parents('li');
                    var elRecipe = $el.data();

                    // Dequeue the crafting request
                    delete p.crafting[elRecipe.name];

                    // Stop the animation
                    $el.stop();

                    // Return the width of the recipe to full-width
                    $el.width(g.recipeWidth)

                    // Hide the cancel icon
                    $(this).hide();

                    // Remove the background animation bar (unless recipe is selected)
                    if (!$el.hasClass('selectedRecipe')) {
                      unselectRecipe($el);
                    }

                    // Prevent the click event from bubbling up to the parent.
                    // This was causing the parent <li> onclick event to fire, selecting the cancelled recipe.
                    event.stopPropagation();
                  }
                }).hide()
              )
            )
            .css('color', g.determineRecipeColor(recipe))
            .click(function() { selectRecipe($(this)) })
            .dblclick(function() { g.craft($('#craftAmount').val()) })
          );
          $('#rn_' + id).width(g.recipeWidth);
        }
      }
    }
  }

  var $current = $('#recipeList li.selectedRecipe');
  if ($current.length) {
    if (!$current.hasClass('animating')) {
      drawRecipeRequirements($current);
    }
  }
}

Game.prototype.drawInventory = function() {
  for (var i = 0; i < this.player.inventory.sorted.length; i++) {
    var prop = this.player.inventory.sorted[i];
    var amount = this.player.inventory.items[prop];
    var id = prop.replace(/ /g, '')
    var value = $('#iv_' + id);
    if (value.length) {
      value.text(amount);
    }
    else {
      var $newRow = $('<tr/>')
        .append(
          $('<td/>',
          {
            id: 'in_' + id,
            text: prop,
            class: 'alignRight'
          })
        )
        .append(
          $('<td/>',
          {
            id: 'iv_' + id,
            text: amount
          })
        );

      // If no invetory rows exist, add it to the <tbody>
      var $tbody = $('#inventoryTable tbody');
      var $rows = $('#inventoryTable td[id*=in]');
      if (!$rows.length) {
        $tbody.append($newRow);
        return;
      }

      // Keep the table sorted.
      // Find the first row whose name is alphatetically greater than the new name
      var $row = null;
      $('#inventoryTable td[id*=in]').each(function() {
        if ($(this).text().localeCompare(prop) == 1) {
          $row = $(this).parent();
          return false;
        }
      });

      if ($row) {
        $row.before($newRow);
      }
      else {
        // No row found, put it at the end
        $('#inventoryTable tbody tr:last').after($newRow);
      }
    }
  }
}

Game.prototype.determineRecipeColor = function(recipe) {
  var g = window.game;
  var p  = g.player;

  var diff = p.determineRecipeDifficulty(recipe);
  return g.difficultyColors[diff];
}

Game.prototype.r = function() {
  return Math.random();
}

var game = new Game();

selectRecipe = function(el) {
  var $current = $('#recipeList li.selectedRecipe');
  if ($current.length) {
    if (!$current.hasClass('animating')) {
      unselectRecipe($current);
    }

    $current.removeClass('selectedRecipe');
  }

  if (!el.hasClass('animating') ) {
    el.css('background-color', el.css('color'))
    el.css('color', '')
    el.addClass('background');
  }

  var disabled = el.find('span').text() == '';
  $('#craft').prop('disabled', disabled);
  $('#craftAll').prop('disabled', disabled);

  el.addClass('selectedRecipe');

  drawRecipeRequirements(el);
}

unselectRecipe = function(el) {
  el.removeClass('background');
  el.css('color', el.css('background-color'))
  el.css('background-color', '')
}

drawRecipeRequirements = function(el) {
  var g = window.game;
  var p = g.player;

  var $div = $('#recipeRequirements');
  var recipe = el.data();
  var id = recipe.name.replace(/ /g, '')

  $div.empty();

  $('<h1/>', {
    id: 'recipeName',
    text: recipe.name,
  }).appendTo($div);

  $('<h4/>', {
    id: 'craftTime',
    text: 'Craft time: ' + createTimeString(recipe.craftTime),
  }).appendTo($div);

  if (recipe.text) {
    $('<p/>', {
      text: recipe.text,
      class: 'recipeDesc'
    }).appendTo($div);
  }

  if (recipe.forge) {
    var $reqForge = $('<p/>', {
      id: 'requiresForge',
      text: 'Requires ' + recipe.forge.name,
    }).appendTo($div);

    if (!p.inventory.forges.some(function(f) { return f.level >= recipe.forge.level })) {
      $reqForge.addClass('missing');
    }
  }

  var $table = $('<table/>', {
    id: 'recipeRequirementList'
  });

  var $tbody = $('<tbody/>');
  for (var i = 0; i < recipe.Requirements.length; i++) {
    var req = recipe.Requirements[i];

    var missingAmount = 0;
    var currentAmount = p.inventory.items[req.resource.name] ? p.inventory.items[req.resource.name] : 0;
    if (currentAmount < req.amount) {
      missingAmount = req.amount - currentAmount;
    }

    var $row = $('<tr/>');
    $('<td/>', {
      id: 'rrv_' + id,
      class: 'alignRight',
      text: (missingAmount > 0 ? currentAmount + '/' : '') + req.amount
    }).appendTo($row);

    $('<td/>', {
      id: 'rrn_' + id,
      text: req.resource.name
    }).appendTo($row);

    if (missingAmount > 0) {
      $row.addClass('missing');
    }

    $tbody.append($row);
  }

  $table.append($tbody);
  $div.append($table);
}

createTimeString = function(time) {
  // http://stackoverflow.com/a/11486026
  var mins = ~~(time / 60);
  var secs = time % 60;

  // Hours, minutes and seconds
  var hrs = ~~(time / 3600);
  var mins = ~~((time % 3600) / 60);
  var secs = time % 60;

  // Output like "1:01" or "4:03:59" or "123:03:59"
  ret = "";

  if (hrs > 0) {
      ret += "" + hrs + " hour" + (hrs > 1 ? "s" : "") + (mins > 0 || secs > 0 ? ", " : "");
  }

  if (mins > 0) {
    ret += "" + mins + " minute" + (mins > 1 ? "s" : "") + (secs > 0 ? ", " : "");
  }
  
  ret += "" + secs + " second" + (secs > 1 ? "s" : "");
  return ret;
}

$(document).ready(function() {
    $('body')
      .bind("contextmenu", function(e) { return false; })
      .attr('unselectable', 'on')
      .css({
        MozUserSelect: 'none',
        KhtmlUserSelect: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      })
      .each(function() { 
        this.onselectstart = function() { return false; };
    });

    game.drawLevel();
    game.drawRecipes();
    game.recipeWidth = $('#recipeList li:first').width();
    $('#forges').hide();
});

$(document).keypress(function(e) {
  if (e.which == 32) { // space
    game.craft($('#craftAmount').val())
  }
  else if (e.which == 103) { // 'g'
    game.step();
  }
});

(function($) {
    $.fn.hasScrollBar = function() {
        return this.get(0).scrollHeight > this.height();
    }
})(jQuery);