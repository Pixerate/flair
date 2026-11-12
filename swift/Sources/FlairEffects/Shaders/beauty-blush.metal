// flair-metal-hash: 12c95693
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
    packed_float3 uColour;
    float uAmount;
    float uDepth;
    float uSkinOnly;
    float2 uCentre;
    float uSpacing;
    float2 uSize;
    float uFeather;
    char _m21_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_beauty_blush_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _79)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_79.uBackdrop) * _79.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_79.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _79)
{
    float4 _223;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _223 = overBackdrop(param, _79);
    }
    else
    {
        float2 param_1 = fract(uv);
        _223 = float4(testCard(param_1), 1.0);
    }
    return _223;
}

static inline __attribute__((always_inline))
float2 pairLocal(thread const float2& fragCoord, constant FlairUniforms& _79)
{
    float2 hs = fast::max((_79.uSize * 0.5) * float2(_79.iResolution[0], _79.iResolution[1]), float2(1.0));
    float2 p = fragCoord - (_79.uCentre * float2(_79.iResolution[0], _79.iResolution[1]));
    p.x = abs(p.x) - (_79.uSpacing * _79.iResolution[0u]);
    return p / hs;
}

static inline __attribute__((always_inline))
float pairRegion(thread const float2& fragCoord, constant FlairUniforms& _79)
{
    float2 hs = fast::max((_79.uSize * 0.5) * float2(_79.iResolution[0], _79.iResolution[1]), float2(1.0));
    float2 param = fragCoord;
    float d = (length(pairLocal(param, _79)) - 1.0) * fast::min(hs.x, hs.y);
    return 1.0 - smoothstep(((-0.5) * _79.uFeather) - 0.5, (0.5 * _79.uFeather) + 0.5, d);
}

static inline __attribute__((always_inline))
float skinLike(thread const float3& c)
{
    float y = dot(c, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625));
    float cb = ((0.5 - (0.16869999468326568603515625 * c.x)) - (0.3312999904155731201171875 * c.y)) + (0.5 * c.z);
    float cr = ((0.5 + (0.5 * c.x)) - (0.4187000095844268798828125 * c.y)) - (0.081299997866153717041015625 * c.z);
    return (((smoothstep(0.5299999713897705078125, 0.569999992847442626953125, cr) * smoothstep(0.7200000286102294921875, 0.680000007152557373046875, cr)) * smoothstep(0.2800000011920928955078125, 0.319999992847442626953125, cb)) * smoothstep(0.519999980926513671875, 0.4799999892711639404296875, cb)) * smoothstep(0.0599999986588954925537109375, 0.1599999964237213134765625, y);
}

static inline __attribute__((always_inline))
float3 toOklab(thread float3& c)
{
    c = powr(fast::max(c, float3(0.0)), float3(2.2000000476837158203125));
    float3 lms = float3x3(float3(0.4122000038623809814453125, 0.2118999958038330078125, 0.088299997150897979736328125), float3(0.536300003528594970703125, 0.680700004100799560546875, 0.2816999852657318115234375), float3(0.051399998366832733154296875, 0.107400000095367431640625, 0.62999999523162841796875)) * c;
    lms = powr(lms, float3(0.3333333432674407958984375));
    return float3x3(float3(0.2105000019073486328125, 1.97800004482269287109375, 0.02590000070631504058837890625), float3(0.793600022792816162109375, -2.4286000728607177734375, 0.782800018787384033203125), float3(-0.0041000000201165676116943359375, 0.4505999982357025146484375, -0.808700025081634521484375)) * lms;
}

static inline __attribute__((always_inline))
float3 fromOklab(thread const float3& c)
{
    float3 lms = float3x3(float3(1.0), float3(0.3962999880313873291015625, -0.10559999942779541015625, -0.089500002562999725341796875), float3(0.21580000221729278564453125, -0.063900001347064971923828125, -1.29149997234344482421875)) * c;
    lms = (lms * lms) * lms;
    float3 rgb = float3x3(float3(4.0767002105712890625, -1.2683999538421630859375, -0.0041999998502433300018310546875), float3(-3.3076999187469482421875, 2.6098001003265380859375, -0.70340001583099365234375), float3(0.231000006198883056640625, -0.34130001068115234375, 1.70759999752044677734375)) * lms;
    return powr(fast::max(rgb, float3(0.0)), float3(0.4545454680919647216796875));
}

static inline __attribute__((always_inline))
float3 tintKeepLight(thread const float3& c, thread const float3& tint, thread const float& k, thread const float& depth)
{
    float3 param = c;
    float3 _465 = toOklab(param);
    float3 a = _465;
    float3 param_1 = tint;
    float3 _469 = toOklab(param_1);
    float3 b = _469;
    float l = mix(a.x, (a.x * b.x) / 0.699999988079071044921875, depth);
    float3 param_2 = mix(a, float3(l, b.yz), float3(k));
    return fast::clamp(fromOklab(param_2), float3(0.0), float3(1.0));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _79, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = fragCoord / float2(_79.iResolution[0], _79.iResolution[1]);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _79);
    float2 param_1 = fragCoord;
    float3 param_2 = pic.xyz;
    float m = (pairRegion(param_1, _79) * mix(1.0, skinLike(param_2), _79.uSkinOnly)) * _79.uAmount;
    float4 _526;
    if (m <= 0.0)
    {
        _526 = pic;
    }
    else
    {
        float3 param_3 = pic.xyz;
        float3 param_4 = float3(_79.uColour);
        float param_5 = m;
        float param_6 = _79.uDepth;
        _526 = float4(tintKeepLight(param_3, param_4, param_5, param_6), pic.w);
    }
    fragColor = _526;
}

fragment flair_beauty_blush_frag_out flair_beauty_blush_frag(constant FlairUniforms& _79 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_beauty_blush_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _564;
    if (_79.flair_flipY > 0.5)
    {
        _564 = _79.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _564 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _564);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _79, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

