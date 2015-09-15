module example.systems {

  import HashMap = artemis.utils.HashMap;

  import Position = example.components.Position;
  import Sprite = example.components.Sprite;

  import Aspect = artemis.Aspect;
  import ComponentMapper = artemis.ComponentMapper;
  import Entity = artemis.Entity;
  import EntitySystem = artemis.EntitySystem;
  import Bag = artemis.utils.Bag;
  import ImmutableBag = artemis.utils.ImmutableBag;
  import Mapper = artemis.annotations.Mapper;
  import Constants = example.core.Constants;

  export class SpriteRenderSystem extends EntitySystem {
    @Mapper(Position) pm:ComponentMapper<Position>;
    @Mapper(Sprite) sm:ComponentMapper<Sprite>;

    private regions:HashMap<String, Object>;

    private regionsByEntity:Bag<Object>;
    private sortedEntities:Array<Entity>;

    private game:PIXI.Container;
    private resources;

    constructor(game:PIXI.Container, resources) {
      super(Aspect.getAspectForAll(Position, Sprite));
      this.game = game;
      this.resources = resources;
    }


    public initialize() {

      var textureAtlas = this.resources['res/images.json'].data; //.frames;

      this.regions = new HashMap<String, Object>();

      for (var name in textureAtlas.frames) {
        var r = textureAtlas.frames[name];
        this.regions.put(name, r);
      }
      this.regionsByEntity = new Bag<Object>();

      this.sortedEntities = new Array<Entity>();

    }


    protected checkProcessing():boolean {
      return true;
    }


    public processEntities(entities:ImmutableBag<Entity>) {
      for (var i = 0; this.sortedEntities.length > i; i++) {
        this.processEach(this.sortedEntities[i]);
      }
    }

    public processEach(e:Entity) {
      if (this.pm.has(e)) {
        var position:Position = this.pm.getSafe(e);
        var sprite:Sprite = this.sm.get(e);

        sprite.sprite_.position = new PIXI.Point(position.x * 2, position.y);
      }
    }


    public inserted(e:Entity) {
      var sprite:Sprite = this.sm.get(e);

      //this.regionsByEntity.set(e.getId(), this.regions.get(sprite.name));

      // sortedEntities.add(e);
      this.sortedEntities.push(e);

      this.sortedEntities.sort((e1:Entity, e2:Entity) => {
        var s1:Sprite = this.sm.get(e1);
        var s2:Sprite = this.sm.get(e2);
        return s1.layer - s2.layer;
      });

    }


    protected removed(e:Entity) {
      var c:Sprite = <Sprite> e.getComponentByType(Sprite);
      c.removeFrom(this.game);

      //this.regionsByEntity.set(e.getId(), null);
      var index = this.sortedEntities.indexOf(e);
      if (index != -1) {
        this.sortedEntities.splice(index, 1);
      }
    }

  }
}

