// flair-metal-hash: 7b249f8a
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uSize;
    float uFloor;
    float uStrength;
    float uFade;
    float uBlur;
    float uRipple;
    float uFloat;
    float uBob;
    float uSpot;
    float3 uBackgroundColor;
    packed_float3 uFloorColor;
    float uBackgroundAlpha;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_floor_reflection_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float imageAspect(texture2d<float> uImage, sampler uImageSmplr)
{
    float2 size = float2(int2(uImage.get_width(), uImage.get_height()));
    float _334;
    if (size.x > 1.0)
    {
        _334 = size.x / size.y;
    }
    else
    {
        _334 = 1.77777779102325439453125;
    }
    return _334;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _155)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_155.uBackdrop) * _155.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_155.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureBlurRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& blurPx, constant FlairUniforms& _155)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    if (size.x <= 1.0)
    {
        float2 param = fract(uv);
        return float4(testCard(param), 1.0);
    }
    float4 param_1 = tex.sample(texSmplr, uv, level(log2(fast::max((blurPx * size.x) / _155.iResolution[0u], 1.0))));
    return overBackdrop(param_1, _155);
}

static inline __attribute__((always_inline))
float onImage(thread const float2& s, thread const float2& pxInS)
{
    float2 e = fast::min(s, float2(1.0) - s) / pxInS;
    return fast::clamp(fast::min(e.x, e.y) + 0.5, 0.0, 1.0);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _155, texture2d<float> uImage, sampler uImageSmplr)
{
    float px = 1.0 / _155.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _155.iResolution[0u] * px;
    float2 box = float2(_155.uSize * imageAspect(uImage, uImageSmplr), _155.uSize);
    box *= fast::min(1.0, (0.920000016689300537109375 * aspect) / box.x);
    float base = (_155.uFloor + _155.uFloat) + ((_155.uBob * 0.0199999995529651641845703125) * (0.5 + (0.5 * sin(_155.iTime * 1.60000002384185791015625))));
    float2 origin = float2((0.5 * aspect) - (0.5 * box.x), base);
    float2 pxInS = float2(px) / box;
    float2 middle = origin + (box * 0.5);
    float3 col = _155.uBackgroundColor + float3((_155.uSpot * 0.2199999988079071044921875) * exp((-dot(p - middle, p - middle)) / ((box.y * box.y) * 0.89999997615814208984375)));
    float onFloor = smoothstep(_155.uFloor + px, _155.uFloor - px, p.y);
    float under = exp(-powr((p.x - middle.x) / (box.x * 0.800000011920928955078125), 2.0)) * exp((-(_155.uFloor - p.y)) / (box.y * 0.60000002384185791015625));
    float3 floorCol = float3(_155.uFloorColor) + float3((_155.uSpot * 0.07999999821186065673828125) * under);
    col = mix(col, floorCol, float3(onFloor));
    float depth = fast::max(_155.uFloor - p.y, 0.0);
    float2 m = float2(p.x, (2.0 * _155.uFloor) - p.y);
    if (_155.uRipple > 0.0)
    {
        float2 param = float2(p.x * 6.0, (depth * 90.0) - (_155.iTime * 2.0));
        m.x += (((_155.uRipple * 0.01200000010430812835693359375) * (vnoise(param) - 0.5)) * (0.20000000298023223876953125 + (depth * 8.0)));
    }
    float2 rs = (m - origin) / box;
    float2 param_1 = rs;
    float param_2 = 1.0 + (((_155.uBlur * 60.0) * depth) / box.y);
    float2 param_3 = rs;
    float2 param_4 = pxInS;
    float4 refl = pictureBlurRGBA(uImage, uImageSmplr, param_1, param_2, _155) * onImage(param_3, param_4);
    float reach = 1.0 - smoothstep(0.0, _155.uFade * box.y, depth + (base - _155.uFloor));
    col = mix(col, refl.xyz, float3(((refl.w * reach) * _155.uStrength) * onFloor));
    float contact = exp(-powr((p.x - middle.x) / (box.x * 0.550000011920928955078125), 2.0)) * exp((-abs(p.y - _155.uFloor)) / (0.01200000010430812835693359375 + _155.uFloat));
    col *= (1.0 - (((0.5 * contact) * onFloor) * (1.0 - (_155.uStrength * 0.5))));
    float2 s = (p - origin) / box;
    float2 param_5 = s;
    float param_6 = 1.0;
    float4 subject = pictureBlurRGBA(uImage, uImageSmplr, param_5, param_6, _155);
    float2 param_7 = s;
    float2 param_8 = pxInS;
    float on = onImage(param_7, param_8) * subject.w;
    col = mix(col, subject.xyz, float3(on));
    fragColor = float4(col, fast::max(_155.uBackgroundAlpha, fast::max(on, ((refl.w * reach) * _155.uStrength) * onFloor)));
}

fragment flair_floor_reflection_frag_out flair_floor_reflection_frag(constant FlairUniforms& _155 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_floor_reflection_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _726;
    if (_155.flair_flipY > 0.5)
    {
        _726 = _155.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _726 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _726);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _155, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

